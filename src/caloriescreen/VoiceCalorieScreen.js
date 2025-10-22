import { Ionicons } from "@expo/vector-icons";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import supabase from "../lib/supabase";
import { createFoodLog } from "../utils/api";

const VoiceCalorieScreen = ({ navigation, route }) => {
  const { mealType = "Quick Log", selectedDate } = route.params || {};
  const recordingRef = useRef(null);
  const ensureAudioPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (has) return true;
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        return res === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS: rely on system prompt when starting recording (NSMicrophoneUsageDescription set)
      return true;
    } catch (error) {
      console.log('Permission error:', error);
      return false;
    }
  };
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [nutritionData, setNutritionData] = useState(null);
  const [transcribedText, setTranscribedText] = useState("");
  const [lastRecordingUri, setLastRecordingUri] = useState(null);
  const micPulse = useRef(new Animated.Value(0)).current;
  const [showListening, setShowListening] = useState(false);
  const [audioLevels, setAudioLevels] = useState(
    Array.from({ length: 20 }, () => 0)
  );
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);

  // Recording animation removed

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        try {
          recordingRef.current.stopAndUnloadAsync && recordingRef.current.stopAndUnloadAsync();
        } catch (e) {
          // ignore
        } finally {
          recordingRef.current = null;
        }
      }
    };
  }, []);

  // Recording animation removed

  const startRecording = async () => {
    try {
      const hasPerm = await ensureAudioPermission();
      if (!hasPerm) {
        Alert.alert("Permission Required", "Microphone access is needed to record audio.");
        return;
      }
      if (recordingRef.current) {
        try {
          await (recordingRef.current.stopAndUnloadAsync && recordingRef.current.stopAndUnloadAsync());
        } catch (e) {
          // ignore
        } finally {
          recordingRef.current = null;
        }
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setShowListening(true);
      // Start mic pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(micPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(micPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
        ])
      ).start();
      setNutritionData(null);
      setTranscribedText("");
      // No waveform animation; only mic pulse
    } catch (err) {
      console.log('startRecording error (VoiceCalorieScreen):', err);
      Alert.alert("Recording Error", "Could not start recording.");
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    // No recording animation
    // Stop mic pulse
    micPulse.stopAnimation(() => {
      micPulse.setValue(0);
    });
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      // Store URI; conversion is triggered explicitly via Convert button
      if (uri) setLastRecordingUri(uri);
    } catch (error) {
      // ignore
    }
  };

  const handleVoiceToCalorie = async (uri) => {
    setIsLoading(true);
    try {
      // Try different models if one fails
      const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
      let lastError = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const audioData = await FileSystem.readAsStringAsync(uri, {
            encoding: "base64",
          });
          const prompt = `Analyze the food items in this audio. Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting like \`\`\`json.

🚨 CRITICAL QUANTITY PRESERVATION RULES 🚨
1. If the audio does NOT contain any food items or is unclear, respond with: {"error": "No food items detected. Please speak clearly about what you ate."}

2. 🚨 MOST IMPORTANT: ALWAYS preserve EXACT quantities and units mentioned in the audio:
   - If user says "200 grams of black beans" → you MUST output "200g black beans" (NOT "1 black beans")
   - If user says "150 grams of chicken" → you MUST output "150g chicken" (NOT "1 chicken")
   - If user says "1 cup of rice" → you MUST output "1 cup rice" (NOT "1 rice")
   - If user says "2 slices of bread" → you MUST output "2 bread" (NOT "1 bread")
   - If user says "500ml juice" → you MUST output "500ml juice" (NOT "1 juice")

3. 🚨 QUANTITY CONVERSION RULES:
   - "grams" → "g" (e.g., "200 grams" → "200g")
   - "milliliters" → "ml" (e.g., "500 milliliters" → "500ml")
   - "cups" → "cup" (e.g., "1 cup" → "1 cup")
   - "slices" → "slice" (e.g., "2 slices" → "2")
   - "pieces" → "piece" (e.g., "3 pieces" → "3")

4. 🚨 EXAMPLES OF CORRECT EXTRACTION:
   - "I had 200 grams of black beans" → extract "200g black beans"
   - "I ate 150 grams of chicken" → extract "150g chicken"
   - "I had 1 cup of rice" → extract "1 cup rice"
   - "I ate 2 slices of pizza" → extract "2 pizza"
   - "I had a chicken sandwich and a juice" → extract "1 chicken sandwich" and "1 juice"
   - "I ate 2 apples and a sandwich" → extract "2 apple" and "1 sandwich"
   - "I had 3 pieces of pizza" → extract "3 pizza"
   - "I had a burger and fries" → extract "1 burger" and "1 fries"

5. 🚨 WRONG EXAMPLES (DO NOT DO THIS):
   - "200 grams of black beans" → "1 black beans" ❌ WRONG!
   - "150g chicken" → "1 chicken" ❌ WRONG!
   - "1 cup rice" → "1 rice" ❌ WRONG!

6. If no specific quantity is mentioned, assume quantity of 1 (e.g., "1 sandwich", "1 juice")
7. Convert words to numbers: "one" → "1", "two" → "2", "three" → "3", etc.

8. 🚨 NUTRITION CALCULATION FOR GRAM-BASED ITEMS:
   - For "200g black beans": Calculate 2x the nutrition of 100g black beans
   - For "150g chicken": Calculate 1.5x the nutrition of 100g chicken
   - Black beans: ~120 calories per 100g, 8g protein, 22g carbs, 0.5g fat, 7g fiber
   - Chicken: ~165 calories per 100g, 31g protein, 0g carbs, 3.6g fat, 0g fiber

9. For complete dishes, use standard values:
   - Chicken sandwich: ~450 calories, 25g protein, 35g carbs, 20g fat, 3g fiber
   - Juice: ~120 calories, 1g protein, 30g carbs, 0g fat, 1g fiber
   - Pizza: ~280 calories, 12g protein, 30g carbs, 12g fat, 2g fiber
   - Burger: ~550 calories, 30g protein, 40g carbs, 25g fat, 3g fiber

The JSON object must have this structure: 
{ "transcription": "The full text of what you heard", "items": [ { "name": "EXACT_QUANTITY + food item", "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } ], "total": { "calories": <number>, "protein": <number>, "carbs": <number>, "fat": <number>, "fiber": <number> } }`;

          const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: "audio/mp4", data: audioData } },
          ]);
          const response = await result.response;
          let text = response.text();

          console.log("VoiceCalorieScreen - Raw AI response:", text);

          const jsonMatch = text.match(/\{[\s\S]*\}/);

          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            console.log("VoiceCalorieScreen - Extracted JSON:", jsonString);
            const data = JSON.parse(jsonString);
            // Check for error response
            if (data.error) {
              throw new Error(data.error);
            }

            if (
              !data.total ||
              !Array.isArray(data.items) ||
              !data.transcription
            ) {
              throw new Error("Invalid JSON structure from API.");
            }

            // Check if any food items were detected
            if (data.items.length === 0) {
              throw new Error(
                "No food items detected. Please speak clearly about what you ate."
              );
            }
            setTranscribedText(data.transcription);
            setShowListening(false);
            setNutritionData({ ...data.total, items: data.items });

            // Create clean food name from extracted items (just quantities and food names)
            const cleanFoodName = data.items
              .map((item) => item.name)
              .join(", ");

            console.log("VoiceCalorieScreen - Generated data:", data);
            console.log("VoiceCalorieScreen - Items:", data.items);
            console.log("VoiceCalorieScreen - Clean food name:", cleanFoodName);
            console.log("VoiceCalorieScreen - Total nutrition:", data.total);

            navigation.replace("VoicePostCalorieScreen", {
              analysis: {
                total: {
                  calories: data.total.calories,
                  protein: data.total.protein,
                  fat: data.total.fat,
                  carbs: data.total.carbs,
                  fiber: data.total.fiber || 0,
                },
                items: data.items,
              },
              cleanFoodName: cleanFoodName,
            });
            return;
          } else {
            throw new Error(
              "Invalid JSON format from API. No JSON object found."
            );
          }
        } catch (error) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
          // Continue to next model
        }
      }

      // If all models failed, show error
      throw lastError || new Error("All AI models are currently unavailable.");
    } catch (error) {
      const msg = String(error?.message || "").toLowerCase();
      // User-friendly fallback when speech wasn't recognized
      if (
        msg.includes("no food items detected") ||
        msg.includes("invalid json") ||
        msg.includes("no json object") ||
        msg.includes("empty") ||
        msg.includes("silence") ||
        msg.includes("404") ||
        msg.includes("not found") ||
        msg.includes("models/") ||
        msg.includes("generatecontent") ||
        msg.includes("api version") ||
        msg.includes("all ai models are currently unavailable")
      ) {
        Alert.alert("Please speak more clearly", "We couldn't recognize the audio. Try moving closer to the mic and speaking a bit louder.");
      } else if (msg.includes("503") || msg.includes("overloaded")) {
        Alert.alert("AI busy", "Service is temporarily overloaded. Please try again in a few moments.");
      } else if (msg.includes("api key")) {
        Alert.alert("Configuration issue", "AI service configuration error. Please check your settings.");
      } else {
        Alert.alert("Please speak more clearly", "We couldn't recognize the audio. Try moving closer to the mic and speaking a bit louder.");
      }
      setShowListening(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmLog = async () => {
    if (!nutritionData) return;
    try {
      const logData = {
        meal_type: mealType,
        food_name: nutritionData.items.map((i) => i.name).join(", "),
        calories: nutritionData.calories,
        protein: nutritionData.protein,
        carbs: nutritionData.carbs,
        fat: nutritionData.fat,
        date: selectedDate || new Date().toISOString().slice(0, 10),
        user_id: null,
      };
      const {
        data: { session },
      } = await supabase.auth.getSession();
      logData.user_id = session?.user?.id;
      if (!logData.user_id) {
        Alert.alert("You must be logged in to log food.");
        return;
      }
      await createFoodLog(logData);
      
      // Optimistic cache update (Instagram pattern)
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic } = require('../utils/cacheManager');
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      
      Alert.alert("Success", "Food logged successfully!", [
        { text: "OK", onPress: () => navigation.navigate("Home") },
      ]);
    } catch (error) {
      Alert.alert("Error", "Failed to log food. " + error.message);
    }
  };

  const handleBackPress = () => {
    if (isRecording) {
      Alert.alert(
        "Stop Recording?",
        "Are you sure you want to stop recording and go back?",
        [
          {
            text: "No",
            style: "cancel",
            onPress: () => {
              // Continue recording - do nothing
            },
          },
          {
            text: "Yes",
            style: "destructive",
            onPress: async () => {
              // Stop recording and go back to home
              if (recordingRef.current) {
                try {
                  await recordingRef.current.stopAndUnloadAsync();
                  recordingRef.current = null;
                } catch (error) {
                  // ignore
                }
              }
              setIsRecording(false);
              // No recording animation
              navigation.navigate("Home");
            },
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // UI rendering logic
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voice Logging</Text>
        <View style={{ width: 28 }} />
      </View>
      <View style={styles.content}>
        {/* Top spacer for centering content */}
        <View style={styles.topSpacer} />

        {/* Mic visual with ripple + pulse when recording */}
        <View style={styles.micVisualWrap}>
          <View style={styles.micStack}>
            {/* Outer ripple 1 */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micRipple,
                {
                  transform: [
                    {
                      scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }),
                    },
                  ],
                  opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0] }),
                },
              ]}
            />
            {/* Outer ripple 2 (staggered) */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micRipple,
                {
                  transform: [
                    {
                      scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }),
                    },
                  ],
                  opacity: micPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                },
              ]}
            />
            {/* Core circle with pulse */}
            <Animated.View
              style={{
                transform: [
                  {
                    scale: micPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }),
                  },
                ],
                shadowColor: '#7B61FF',
                shadowOpacity: micPulse.interpolate({ inputRange: [0,1], outputRange: [0.15, 0.35]}),
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 0 },
                elevation: 6,
              }}
            >
              <LinearGradient colors={["#EDE7FF", "#E6FAFF"]} style={styles.micOuterCircle}>
                <View style={styles.micInnerCircle}>
                  <Ionicons name="mic" size={40} color="#7B61FF" />
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>

        {/* Dummy real-time transcription box (non-functional) */}
        <View style={styles.transcriptionCard}>
          <Text style={styles.transcriptionLabel}>Real-time transcription...</Text>
          <View style={styles.transcriptionBubble}>
            <Text style={styles.transcriptionText}>
              "I had a large bowl of oatmeal with a handful of blueberries, a tablespoon of chia seeds, and a drizzle of honey, plus a black coffee."
            </Text>
          </View>
        </View>

        {/* Results - stays in center when showing */}
        {nutritionData && !isLoading && (
          <View style={styles.resultContainer}>
            <Text style={styles.transcribedText}>{transcribedText}</Text>
            <View style={styles.foodListContainer}>
              {nutritionData.items.map((item, idx) => (
                <View key={idx} style={styles.foodItemRow}>
                  <Ionicons
                    name="fast-food-outline"
                    size={22}
                    color="#7B61FF"
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foodItemName}>{item.name}</Text>
                    <Text style={styles.foodItemKcal}>
                      {item.calories} kcal
                    </Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="pencil-outline" size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View style={styles.suggestedMealRow}>
              <Text style={styles.suggestedMealLabel}>Suggested Meal</Text>
              <TouchableOpacity>
                <Text style={styles.suggestedMealValue}>{mealType}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color="#888"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Time</Text>
              <TouchableOpacity>
                <Text style={styles.timeValue}>
                  {selectedDate
                    ? new Date(selectedDate).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </Text>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#888"
                  style={{ marginLeft: 4 }}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.editFoodsBtn}>
              <Text style={styles.editFoodsBtnText}>Edit Foods</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setNutritionData(null);
                setTranscribedText("");
              }}
            >
              <Ionicons
                name="refresh"
                size={18}
                color="#7B61FF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.retryBtnText}>Retry Voice Input</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Loading spinner - stays in center */}
        {isLoading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator
              size={50}
              color="#7B61FF"
              style={{ marginVertical: 16 }}
            />
          </View>
        )}

        {/* Recording animation removed as requested */}

        {/* Instructions section at top */}
        <View style={styles.instructionsSection}>
          {!isRecording && !nutritionData && !isLoading && (
            <>
              <Text style={styles.instructions}>
                Speak naturally – Kalry listens & structures it
              </Text>
              <Text style={styles.sampleText}>
                Try: &quot;I had a chicken sandwich and a juice&quot;
              </Text>
            </>
          )}
          {isRecording && !nutritionData && !isLoading && (
            <>
              <Text style={styles.listeningText}>Listening...</Text>
              <Text style={styles.instructions}>
                Speak naturally – Kalry listens & structures it
              </Text>
              <Text style={styles.sampleText}>
                Try: &quot;I had a chicken sandwich and a juice&quot;
              </Text>
            </>
          )}
        </View>

        {/* Action buttons row above bottom */}
        <View style={[styles.actionRow, styles.actionRowFixed]}>
          <TouchableOpacity
            style={[styles.startBtn, isRecording && { opacity: 0.6 }]}
            onPress={startRecording}
            disabled={isRecording || isLoading}
          >
            <Ionicons name="play" size={18} color="#6E54FF" style={{ marginRight: 8 }} />
            <Text style={styles.startBtnText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stopBtn, !isRecording && { opacity: 0.6 }]}
            onPress={stopRecording}
            disabled={!isRecording || isLoading}
          >
            <Ionicons name="stop" size={16} color="#E26B5E" style={{ marginRight: 8 }} />
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>

        {/* Convert button fixed at screen bottom */}
        <TouchableOpacity
          style={[styles.convertBtn, styles.convertFixed, (!lastRecordingUri || isLoading) && { opacity: 0.6 }]}
          onPress={() => lastRecordingUri && handleVoiceToCalorie(lastRecordingUri)}
          disabled={!lastRecordingUri || isLoading}
        >
          <Text style={styles.convertBtnText}>Convert to Calories  →</Text>
        </TouchableOpacity>
      </View>
      {/* Fixed footer for action buttons */}
      {nutritionData && !isLoading && (
        <View style={styles.footerActionRow}>
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={handleConfirmLog}
          >
            <Text style={styles.confirmBtnText}>Confirm & Log</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
    minHeight: 58,
  },
  backButton: { marginRight: 12 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "bold",
    color: "black",
    textAlign: "center",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    justifyContent: "flex-start",
    width: "100%",
  },
  topSpacer: { height: 12 },
  micVisualWrap: { marginTop: 58, marginBottom: 16 },
  micOuterCircle: { width: 180, height: 180, borderRadius: 90, alignItems: "center", justifyContent: "center" },
  micInnerCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 8, borderColor: "#F1EAFE" },
  micStack: { alignItems: "center", justifyContent: "center" },
  micRipple: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#8B78FF20" },
  transcriptionCard: { width: "100%", marginTop: 46, paddingHorizontal: 4 },
  transcriptionLabel: { color: "#8B78FF", fontSize: 14, marginLeft: 10, marginBottom: 8 },
  transcriptionBubble: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#EEEAFB", padding: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8 },
  transcriptionText: { color: "#222", fontSize: 16, lineHeight: 22 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  instructionsSection: {
    width: "100%",
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 20,
    marginTop: 14,
  },
  bottomSection: {
    width: "100%",
    alignItems: "center",
    paddingBottom: 0,
    paddingTop: 0,
  },
  animationContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  dotContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#7B61FF",
    marginHorizontal: 6,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 60,
    gap: 3,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: "#7B61FF",
  },
  gradientMicWrap: {
    marginVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientMic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: { flexDirection: "row", width: "100%", justifyContent: "space-between", marginTop: 18 },
  actionRowFixed: { position: "absolute", left: 24, right: 24, bottom: 110 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EFEBFF", paddingVertical: 14, borderRadius: 24, paddingHorizontal: 22, width: "48%" },
  startBtnText: { color: "#6E54FF", fontWeight: "bold", fontSize: 16 },
  stopBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FFEDEA", paddingVertical: 14, borderRadius: 24, paddingHorizontal: 22, width: "48%" },
  stopBtnText: { color: "#E26B5E", fontWeight: "bold", fontSize: 16 },
  convertBtn: { width: "100%", backgroundColor: "#7B61FF", borderRadius: 22, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  convertBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  convertFixed: { position: "absolute", left: 24, right: 24, bottom: 20 },
  instructions: {
    color: "#888",
    marginTop: 8,
    fontSize: 15,
    textAlign: "center",
  },
  sampleText: {
    color: "#bbb",
    marginTop: 2,
    fontSize: 13,
    textAlign: "center",
  },
  listeningText: {
    color: "#7B61FF",
    fontWeight: "bold",
    marginBottom: 8,
    fontSize: 18,
    textAlign: "center",
  },
  resultContainer: { width: "100%", marginTop: 10, alignItems: "center" },
  transcribedText: {
    color: "#222",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  foodListContainer: { width: "100%", marginBottom: 16 },
  foodItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F6F6",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  foodItemName: { fontSize: 15, fontWeight: "600", color: "#222" },
  foodItemKcal: { fontSize: 13, color: "#888" },
  suggestedMealRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  suggestedMealLabel: { color: "#888", fontSize: 14 },
  suggestedMealValue: { color: "#222", fontWeight: "600", fontSize: 15 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  timeLabel: { color: "#888", fontSize: 14 },
  timeValue: { color: "#222", fontWeight: "600", fontSize: 15 },
  editFoodsBtn: {
    backgroundColor: "#F3F0FF",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  editFoodsBtnText: { color: "#7B61FF", fontWeight: "bold", fontSize: 15 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  retryBtnText: { color: "#7B61FF", fontWeight: "bold", fontSize: 15 },
  footerActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    padding: 18,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#eee",
    position: "absolute",
    bottom: 20,
    left: 0,
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: "linear-gradient(90deg, #7B61FF 0%, #43E0FF 100%)",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginRight: 8,
  },
  confirmBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },
  cancelBtnText: { color: "#7B61FF", fontWeight: "bold", fontSize: 16 },
});

export default VoiceCalorieScreen;
