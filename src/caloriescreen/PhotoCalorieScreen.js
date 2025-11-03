import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CompassionateFeedbackEngine } from '../algorithms/CompassionateFeedbackEngine';
import supabase from '../lib/supabase';
import { createFoodLog } from '../utils/api';

const PhotoCalorieScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { photoUri, mealType } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedFoodName, setEditedFoodName] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);
  const [macros, setMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  const moodOptions = [
    { emoji: '😀', label: 'Happy' },
    { emoji: '😊', label: 'Content' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😞', label: 'Sad' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '😤', label: 'Stressed' },
  ];

  // Initialize Gemini AI
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('PhotoCalorieScreen - No API key found!');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  useEffect(() => {
    if (photoUri) {
      analyzePhoto();
    }
  }, [photoUri]);

  const analyzePhoto = async () => {
    setIsLoading(true);
    try {
      const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
      let lastError = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          
          const imageData = await FileSystem.readAsStringAsync(photoUri, {
            encoding: 'base64',
          });

          const prompt = `Analyze this food image and provide detailed nutritional information. Your response MUST be a single valid JSON object and nothing else. Do not include markdown formatting.

If the image does NOT contain recognizable food items, respond with: {"error": "No food items detected in this image. Please take a photo of food items."}

If food is detected, provide this exact JSON structure:
{
  "dish_name": "Main dish name (e.g., 'Grilled Chicken Salad')",
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": "estimated amount (e.g., '100g', '1 cup', '2 slices')"
    }
  ],
  "total_nutrition": {
    "calories": <number>,
    "protein": <number>,
    "fat": <number>,
    "carbs": <number>,
    "fiber": <number>,
    "micronutrients": {
      "iron": <boolean>,
      "potassium": <boolean>,
      "vitaminC": <boolean>,
      "calcium": <boolean>
    }
  },
  "confidence_level": <number between 0-100>
}

Guidelines:
- Be realistic with portion sizes
- Consider cooking methods (fried foods have more calories)
- Include all visible ingredients
- Provide nutritional values per the entire visible portion
- Confidence should reflect how clearly you can identify the food`;

          const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: "image/jpeg", data: imageData } },
          ]);
          
          const response = await result.response;
          let text = response.text();
          
          console.log('PhotoCalorieScreen - Raw AI response:', text);
          
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            const jsonString = jsonMatch[0];
            console.log('PhotoCalorieScreen - Extracted JSON:', jsonString);
            const data = JSON.parse(jsonString);
            
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (!data.dish_name || !data.total_nutrition || !Array.isArray(data.ingredients)) {
              throw new Error('Invalid JSON structure from API.');
            }
            
            setAnalysis(data);
            setEditedFoodName(data.dish_name);
            setMacros({
              protein: data.total_nutrition.protein || 0,
              carbs: data.total_nutrition.carbs || 0,
              fat: data.total_nutrition.fat || 0,
              fiber: data.total_nutrition.fiber || 0,
            });
            
            console.log('PhotoCalorieScreen - Analysis complete:', data);
            return;
          } else {
            throw new Error('Invalid JSON format from API.');
          }
        } catch (error) {
          lastError = error;
          console.log(`Model ${modelName} failed:`, error.message);
        }
      }
      
      throw lastError || new Error('All AI models are currently unavailable.');
      
    } catch (error) {
      console.error('PhotoCalorieScreen - Analysis error:', error);
      const msg = String(error?.message || "").toLowerCase();
      
      if (
        msg.includes("no food items detected") ||
        msg.includes("invalid json") ||
        msg.includes("no json object")
      ) {
        setShowErrorModal(true);
      } else {
        Alert.alert(
          "Analysis Failed", 
          "We couldn't analyze this image. Please try taking another photo with better lighting and food clearly visible."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!analysis) return;
    try {
      const { dish_name } = analysis;
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      
      if (!user_id) {
        Alert.alert('You must be logged in to log food.');
        return;
      }
      
      // Get selected mood emoji
      const selectedMoodEmoji = selectedMood !== null ? moodOptions[selectedMood].emoji : null;
      
      // Upload photo to Supabase Storage
      let photoUrl = null;
      try {
        const fileName = `food_photos/${user_id}_${Date.now()}.jpg`;
        
        // Read the file using fetch
        const response = await fetch(photoUri);
        const arrayBuffer = await response.arrayBuffer();
        
        const { error: uploadError } = await supabase.storage
          .from('food-photos')
          .upload(fileName, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false
          });
          
        if (uploadError) throw uploadError;
        
        // Store the storage path for later retrieval with signed URL
        photoUrl = fileName;
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        // Continue without photo URL
      }

      const logData = {
        meal_type: mealType,
        food_name: editedFoodName || dish_name,
        calories: analysis.total_nutrition.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        fiber: macros.fiber,
        mood: selectedMoodEmoji,
        photo_url: photoUrl,
        user_id,
        date: new Date().toISOString().slice(0, 10),
      };
      
      await createFoodLog(logData);
      
      // ✅ COMPASSIONATE FEEDBACK IMPLEMENTATION
      const feedbackEngine = new CompassionateFeedbackEngine();
      const foodData = {
        name: editedFoodName || dish_name,
        calories: analysis.total_nutrition.calories,
        protein: macros.protein || 0,
        carbs: macros.carbs || 0,
        fat: macros.fat || 0,
        fiber: macros.fiber || 0,
        micronutrients: analysis.total_nutrition.micronutrients || {},
        category: 'meal'
      };
      
      // Add meal context for better feedback
      const mealContext = {
        mealType: mealType,
        timeOfDay: new Date().getHours(),
        mood: selectedMood !== null ? moodOptions[selectedMood].label : null
      };
      
      const feedback = feedbackEngine.generateFoodFeedback(foodData, mealContext);
      
      // Show compassionate feedback instead of generic success
      Alert.alert(
        "Food Logged! 🍽️",
        feedback.message,
        [{ 
          text: "Great!", 
          style: "default", 
          onPress: () => navigation.navigate('Home') 
        }]
      );
      
      // Optimistic cache update
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic } = require('../utils/cacheManager');
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      
    } catch (error) {
      console.error('Error logging food:', error);
      Alert.alert('Error', 'Failed to log food. ' + error.message);
    }
  };

  const handleSaveToSavedMeals = async () => {
    if (!analysis) return;
    try {
      const { dish_name, total_nutrition, ingredients } = analysis;
      const { data: { session } } = await supabase.auth.getSession();
      const user_id = session?.user?.id;
      
      if (!user_id) {
        Alert.alert('You must be logged in to save meals.');
        return;
      }

      const { data, error } = await supabase
        .from('saved_meals')
        .insert({
          user_id,
          name: editedFoodName || dish_name,
          ingredients: JSON.stringify(ingredients),
          calories: total_nutrition.calories,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          fiber: macros.fiber,
        });

      if (error) throw error;
      
      // ✅ COMPASSIONATE FEEDBACK FOR SAVED MEALS
      const feedbackEngine = new CompassionateFeedbackEngine();
      const foodData = {
        name: editedFoodName || dish_name,
        calories: total_nutrition.calories,
        protein: macros.protein || 0,
        carbs: macros.carbs || 0,
        fat: macros.fat || 0,
        fiber: macros.fiber || 0,
        micronutrients: total_nutrition.micronutrients || {},
        category: 'meal'
      };
      
      const feedback = feedbackEngine.generateFoodFeedback(foodData);
      
      Alert.alert(
        'Meal Saved! 💾', 
        `${feedback.message}\n\nThis meal has been added to your Saved Meals for easy logging later!`,
        [{ 
          text: 'Great!', 
          onPress: () => navigation.navigate('SavedMealsScreen')
        }]
      );
      
    } catch (error) {
      console.error('Error saving meal:', error);
      Alert.alert('Error', 'Failed to save meal. ' + error.message);
    }
  };

  const handleEditFood = () => {
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    setShowEditModal(false);
    // Update analysis with new values
    if (analysis) {
      setAnalysis({
        ...analysis,
        dish_name: editedFoodName,
        total_nutrition: {
          ...analysis.total_nutrition,
          calories: macros.protein * 4 + macros.carbs * 4 + macros.fat * 9,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
          fiber: macros.fiber,
        }
      });
    }
  };

  const handleRetakePhoto = () => {
    navigation.goBack();
  };

  const handleErrorRetry = () => {
    setShowErrorModal(false);
    navigation.goBack();
  };

  if (showErrorModal) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="camera-outline" size={80} color="#ccc" />
          <Text style={styles.errorTitle}>No Food Detected</Text>
          <Text style={styles.errorMessage}>
            We couldn&apos;t identify any food in this image. Please try taking another photo with:
          </Text>
          <View style={styles.errorTips}>
            <Text style={styles.errorTip}>• Good lighting</Text>
            <Text style={styles.errorTip}>• Food clearly visible</Text>
            <Text style={styles.errorTip}>• Camera focused on the food</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={handleErrorRetry}>
            <Text style={styles.retryButtonText}>Take Another Photo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={50} color="#7B61FF" />
          <Text style={styles.loadingText}>Analyzing your food...</Text>
          <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={80} color="#ff4757" />
          <Text style={styles.errorTitle}>Analysis Failed</Text>
          <Text style={styles.errorMessage}>
            We couldn&apos;t analyze this image. Please try taking another photo.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetakePhoto}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Food Analysis</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }}
      >
        {/* Photo */}
        <View style={styles.photoContainer}>
          <Image 
            source={{ 
              uri: photoUri || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' 
            }} 
            style={styles.photo} 
          />
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetakePhoto}>
            <Ionicons name="camera-outline" size={20} color="#7B61FF" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>

        {/* Food Name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identified Food</Text>
            <TouchableOpacity onPress={handleEditFood}>
              <Ionicons name="pencil-outline" size={20} color="#7B61FF" />
            </TouchableOpacity>
          </View>
          <Text style={styles.foodName}>{editedFoodName || analysis.dish_name}</Text>
          <Text style={styles.confidence}>
            Confidence: {analysis.confidence_level || 85}%
          </Text>
        </View>

        {/* Nutrition Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{analysis.total_nutrition.calories}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.protein}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.carbs}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{macros.fat}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients Detected</Text>
          {analysis.ingredients && analysis.ingredients.map((ingredient, index) => (
            <View key={index} style={styles.ingredientItem}>
              <View style={styles.ingredientDot} />
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <Text style={styles.ingredientQuantity}>{ingredient.quantity}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Mood Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How are you feeling?</Text>
          <View style={styles.moodGrid}>
            {moodOptions.map((mood, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.moodOption,
                  selectedMood === index && styles.selectedMood
                ]}
                onPress={() => setSelectedMood(selectedMood === index ? null : index)}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.actionContainer, { paddingBottom: insets.bottom >= 20 ? (insets.bottom + 20) : 20 }]}>
        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSaveToSavedMeals}
        >
          <Ionicons name="bookmark-outline" size={20} color="#7B61FF" />
          <Text style={styles.saveButtonText}>Save Meal</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.confirmButton} 
          onPress={handleConfirm}
        >
          <Text style={styles.confirmButtonText}>Log Food</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      {showEditModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Food Details</Text>
            
            <View style={styles.editSection}>
              <Text style={styles.editLabel}>Food Name</Text>
              <TextInput
                style={styles.editInput}
                value={editedFoodName}
                onChangeText={setEditedFoodName}
                placeholder="Enter food name"
              />
            </View>

            <View style={styles.macroGrid}>
              <View style={styles.macroItem}>
                <Text style={styles.editLabel}>Protein (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={String(macros.protein)}
                  onChangeText={(text) => setMacros({...macros, protein: parseFloat(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.editLabel}>Carbs (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={String(macros.carbs)}
                  onChangeText={(text) => setMacros({...macros, carbs: parseFloat(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.editLabel}>Fat (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={String(macros.fat)}
                  onChangeText={(text) => setMacros({...macros, fat: parseFloat(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.editLabel}>Fiber (g)</Text>
                <TextInput
                  style={styles.macroInput}
                  value={String(macros.fiber)}
                  onChangeText={(text) => setMacros({...macros, fiber: parseFloat(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.saveEditButton} 
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveEditButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  photoContainer: {
    position: 'relative',
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  retakeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#7B61FF',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  foodName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  confidence: {
    fontSize: 14,
    color: '#666',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7B61FF',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7B61FF',
    marginRight: 12,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  moodOption: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  selectedMood: {
    backgroundColor: '#E8E4FF',
    borderWidth: 2,
    borderColor: '#7B61FF',
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    marginRight: 12,
  },
  saveButtonText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '600',
    color: '#7B61FF',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  errorTips: {
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  errorTip: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  retryButton: {
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  editSection: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  macroItem: {
    width: '48%',
    marginBottom: 16,
  },
  macroInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveEditButton: {
    flex: 1,
    backgroundColor: '#7B61FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginLeft: 8,
  },
  saveEditButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PhotoCalorieScreen;
