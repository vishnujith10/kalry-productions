import { Ionicons } from '@expo/vector-icons';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';
import { createFoodLog } from '../utils/api';

const PhotoCalorieScreen = ({ route, navigation }) => {
  const { photoUri, mealType } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editedFoodName, setEditedFoodName] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [macros, setMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  
  // Ref for timeout
  const reanalysisTimeoutRef = useRef(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Helper function to get ingredient icon
  const getIngredientIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('chicken')) return '🍗';
    if (lowerName.includes('rice')) return '🍚';
    if (lowerName.includes('bread')) return '🍞';
    if (lowerName.includes('egg')) return '🥚';
    if (lowerName.includes('milk')) return '🥛';
    if (lowerName.includes('cheese')) return '🧀';
    if (lowerName.includes('vegetable') || lowerName.includes('veg')) return '🥬';
    if (lowerName.includes('fruit')) return '🍎';
    if (lowerName.includes('fish')) return '🐟';
    if (lowerName.includes('beef') || lowerName.includes('meat')) return '🥩';
    if (lowerName.includes('pasta')) return '🍝';
    if (lowerName.includes('soup')) return '🥣';
    if (lowerName.includes('salad')) return '🥗';
    if (lowerName.includes('potato')) return '🥔';
    if (lowerName.includes('tomato')) return '🍅';
    if (lowerName.includes('onion')) return '🧅';
    if (lowerName.includes('garlic')) return '🧄';
    if (lowerName.includes('spice')) return '🌶️';
    if (lowerName.includes('sauce')) return '🥫';
    return '🍽️';
  };

  // Initialize state from analysis
  useEffect(() => {
    if (analysis) {
      // Update macros from analysis
      setMacros({
        protein: analysis?.total_nutrition?.protein || 0,
        carbs: analysis?.total_nutrition?.carbs || 0,
        fat: analysis?.total_nutrition?.fat || 0,
        fiber: analysis?.total_nutrition?.fiber || 0,
      });
      
      // Update ingredients from analysis
      if (analysis?.ingredients && Array.isArray(analysis.ingredients)) {
        const newIngredients = analysis.ingredients.map(item => ({
          name: item?.name || 'Unknown Ingredient',
          amount: '1 serving',
          calories: Math.round(item?.calories || 0),
          icon: getIngredientIcon(item?.name || ''),
        }));
        setIngredients(newIngredients);
      }
      
      console.log('Analysis updated:', analysis.dish_name, 'Calories:', analysis?.total_nutrition?.calories);
    }
  }, [analysis]);

  const moodOptions = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😌', label: 'Calm' },
    { emoji: '🤤', label: 'Satisfied' },
    { emoji: '🥰', label: 'Loved' },
    { emoji: '🤗', label: 'Grateful' },
  ];
  
  // Use environment variables directly (from eas.json in production)
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY || "AIzaSyAJ4Df1p8dHhI88h72aG5CHY5rBFEJBWPQ";
  
  // Debug logging
  console.log('PhotoCalorieScreen - API Key:', apiKey ? 'Found' : 'Missing');
  console.log('PhotoCalorieScreen - process.env:', process.env.EXPO_PUBLIC_GEMINI_API_KEY ? 'Found' : 'Missing');
  console.log('PhotoCalorieScreen - Constants:', Constants.expoConfig?.extra?.EXPO_PUBLIC_GEMINI_API_KEY ? 'Found' : 'Missing');
  
  // Validate API key
  if (!apiKey) {
    console.error('PhotoCalorieScreen - No API key found!');
    throw new Error('AI service configuration error. Please check your settings.');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  useEffect(() => {
    if (photoUri) {
      handleImageToCalorie(photoUri);
    }
    
    // Check available buckets
    const checkBuckets = async () => {
      const { data: buckets, error } = await supabase.storage.listBuckets();
      console.log('Buckets:', buckets?.map(b => b.name), 'Error:', error);
    };
    checkBuckets();
    
    // Cleanup timeout on unmount
    return () => {
      if (reanalysisTimeoutRef.current) {
        clearTimeout(reanalysisTimeoutRef.current);
      }
    };
  }, [photoUri]);

  const handleImageToCalorie = async (uri) => {
    setIsLoading(true);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const imageBase64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        
        const prompt = `
          First, determine if this image contains actual food items that can be eaten. 
          Look for:
          - Real food items (fruits, vegetables, cooked dishes, etc.)
          - NOT: billboards, signs, menus, food packaging, food advertisements, or text-only images
          - NOT: objects that look like food but are not edible
          - NOT: food-related items that are not actual food (utensils, plates without food, etc.)
          
          If the image does NOT contain actual edible food, respond with this exact JSON:
          {
            "is_food": false,
            "error_message": "This image does not contain actual food items. Please take a photo of real food that you want to log."
          }
          
          If the image contains actual edible food, analyze it and respond with this JSON structure:
          {
            "is_food": true,
            "dish_name": "A concise and appealing name for the dish",
            "description": "A one-sentence savory description of the dish.",
            "total_nutrition": {
              "calories": <number>,
              "protein": <number>,
              "fat": <number>,
              "carbs": <number>,
              "fiber": <number>
            },
            "ingredients": [
              { "name": "ingredient name", "calories": <number> },
              { "name": "ingredient name", "calories": <number> }
            ]
          }
          
          IMPORTANT: Provide realistic fiber values based on the food type:
          - Fruits and vegetables: 2-8g fiber per serving
          - Whole grains and breads: 2-4g fiber per serving  
          - Legumes and beans: 5-15g fiber per serving
          - Nuts and seeds: 2-6g fiber per serving
          - Processed foods: 0-2g fiber per serving
          
          Your response MUST be a valid JSON object only. Do not include any text outside of the JSON object.
        `;

        const result = await model.generateContent([prompt, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]);
        const response = await result.response;
        let text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            
            // Check if the image is not food
            if (data.is_food === false) {
                setShowErrorModal(true);
                setIsLoading(false);
                return;
            }
            
            // If it's food, set the analysis
            setAnalysis(data);
        } else {
            throw new Error('Invalid JSON format from API.');
        }

    } catch (error) {
        console.error("Error analyzing image:", error);
        Alert.alert("AI Error", "Could not analyze the image. Please try again.", [
          {
            text: "Try Again",
            onPress: () => {
              // Navigate back to Home instead of CustomCameraScreen
              navigation.navigate('Home');
            }
          }
        ]);
    } finally {
        setIsLoading(false);
    }
  };

  const handleEditFoodName = () => {
    setEditedFoodName(analysis.dish_name);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (editedFoodName.trim()) {
      setShowEditModal(false);
      setIsLoading(true);
      
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const imageBase64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
        
        const prompt = `
          Analyze this image for the specific food item: "${editedFoodName.trim()}"
          
          The user has corrected the food name to: "${editedFoodName.trim()}"
          Please provide accurate nutrition information for this specific food item.
          
          Your response MUST be a valid JSON object only. Do not include any text outside of the JSON object.
          
          The JSON object should have this structure:
          {
            "is_food": true,
            "dish_name": "${editedFoodName.trim()}",
            "description": "A one-sentence savory description of ${editedFoodName.trim()}.",
            "total_nutrition": {
              "calories": <accurate number for ${editedFoodName.trim()}>,
              "protein": <accurate number for ${editedFoodName.trim()}>,
              "fat": <accurate number for ${editedFoodName.trim()}>,
              "carbs": <accurate number for ${editedFoodName.trim()}>,
              "fiber": <accurate number for ${editedFoodName.trim()}>
            },
            "ingredients": [
              { "name": "ingredient name", "calories": <number> },
              { "name": "ingredient name", "calories": <number> }
            ]
          }
          
          Provide accurate nutrition values for a standard serving size of ${editedFoodName.trim()}.
          
          IMPORTANT: Provide realistic fiber values based on the food type:
          - Fruits and vegetables: 2-8g fiber per serving
          - Whole grains and breads: 2-4g fiber per serving  
          - Legumes and beans: 5-15g fiber per serving
          - Nuts and seeds: 2-6g fiber per serving
          - Processed foods: 0-2g fiber per serving
        `;

        const result = await model.generateContent([prompt, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]);
        const response = await result.response;
        let text = response.text();
        
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            
            // Update the analysis with new data
            setAnalysis(data);
        } else {
            throw new Error('Invalid JSON format from API.');
        }

      } catch (error) {
        console.error("Error re-analyzing image:", error);
        Alert.alert("AI Error", "Could not re-analyze the image with the new food name. Please try again.");
        // Fallback: just update the name without re-analyzing
        setAnalysis({
          ...analysis,
          dish_name: editedFoodName.trim()
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSaveToSavedMeals = async () => {
    if (!analysis) return;
    try {
        const { total_nutrition, dish_name, description } = analysis;
        const { data: { session } } = await supabase.auth.getSession();
        const user_id = session?.user?.id;
        if (!user_id) {
          Alert.alert('You must be logged in to save meals.');
          return;
        }
        
        // Upload photo to Supabase storage
        let photoUrl = null;
        if (photoUri) {
          try {
            const fileName = `food-photos/${user_id}/${Date.now()}.jpg`;
            
            // Convert photo URI to ArrayBuffer for upload (works on RN/Expo)
            const response = await fetch(photoUri);
            const arrayBuffer = await response.arrayBuffer();
            
            const { data, error } = await supabase.storage
              .from('food-photos')
              .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg'
              });
            
            if (error) {
              console.error('Error uploading photo:', error);
              // Continue without photo if upload fails
            } else {
              // Store the storage path, not the public URL
              photoUrl = fileName;
            }
          } catch (uploadError) {
            console.error('Error uploading photo:', uploadError);
            // Continue without photo if upload fails
          }
        }
        
        const { error } = await supabase.from('saved_meal').insert([
          {
            user_id: user_id,
            dish_name: dish_name,
            description: description || '',
            calories: total_nutrition.calories || 0,
            protein: total_nutrition.protein || 0,
            carbs: total_nutrition.carbs || 0,
            fat: total_nutrition.fat || 0,
            fiber: total_nutrition.fiber || 0,
            photo_url: photoUrl, // Save the storage path
          },
        ]);
        
        if (error) throw error;
        Alert.alert('Saved!', 'Meal saved to your Saved Meals.', [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('SavedMealsScreen')
          }
        ]);
    } catch (error) {
        console.error('Error saving meal:', error);
        Alert.alert('Error', 'Failed to save meal. ' + error.message);
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
        
        // Upload photo to Supabase storage
        let photoUrl = null;
        if (photoUri) {
          try {
            const fileName = `food-photos/${user_id}/${Date.now()}.jpg`;
            
            // Convert photo URI to ArrayBuffer for upload (works on RN/Expo)
            const response = await fetch(photoUri);
            const arrayBuffer = await response.arrayBuffer();
            
            const { data, error } = await supabase.storage
              .from('food-photos')
              .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg'
              });
            
            if (error) {
              console.error('Error uploading photo:', error);
              // Fallback to local URI if upload fails
              photoUrl = photoUri;
            } else {
              // Store the storage path, not the public URL
              photoUrl = fileName;
            }
          } catch (uploadError) {
            console.error('Error uploading photo:', uploadError);
            // Fallback to local URI if upload fails
            photoUrl = photoUri;
          }
        }
        
        const logData = {
            meal_type: mealType,
            food_name: dish_name,
            calories: total_nutrition.calories,
            protein: macros.protein,
            carbs: macros.carbs,
            fat: macros.fat,
            fiber: macros.fiber,
            mood: selectedMoodEmoji,
            photo_url: photoUrl,
            user_id,
        };
        await createFoodLog(logData);
        console.log('Food logged successfully with photo URL:', photoUrl);
        
        // Optimistic cache update (Instagram pattern) - update cache immediately
        const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic } = require('../utils/cacheManager');
        updateMainDashboardCacheOptimistic(logData);
        updateHomeScreenCacheOptimistic(logData);
        
        Alert.alert('Success', 'Food logged successfully!');
        navigation.navigate('Home'); 
    } catch (error) {
        console.error('Error logging food:', error);
        Alert.alert('Error', 'Failed to log food. ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size={50} color="#7B61FF" />
          <Text style={styles.loadingText}>Analyzing your food...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Could not analyze the image.</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
  
  const { dish_name, description, total_nutrition, ingredients: analysisIngredients } = analysis;

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const calculateHealthScore = () => {
    return 6; // Fixed score to match the design
  };

  const getHealthText = () => {
    return 'Good';
  };

  const getInfoText = () => {
    return 'Low protein content. High in fats. Low fiber content (0g).';
  };

  const handleMacroChange = (key, value) => {
    setMacros({ ...macros, [key]: value });
  };

  // Function to re-analyze food when name changes
  const reanalyzeFood = async (newFoodName) => {
    if (!newFoodName.trim() || newFoodName === analysis.dish_name) {
      console.log('Skipping re-analysis - same name or empty');
      return;
    }
    
    console.log('Starting re-analysis for:', newFoodName);
    setIsLoading(true);
    
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const imageBase64 = await FileSystem.readAsStringAsync(photoUri, { encoding: 'base64' });
      
      const prompt = `
        You are a nutrition expert. Analyze this food image and provide accurate nutrition information for: "${newFoodName.trim()}"
        
        IMPORTANT: The user has corrected the food name to "${newFoodName.trim()}", so provide nutrition data specifically for this food item, not what you see in the image.
        
        Your response MUST be a valid JSON object only. Do not include any text outside of the JSON object.
        
        The JSON object should have this structure:
        {
          "is_food": true,
          "dish_name": "${newFoodName.trim()}",
          "description": "A one-sentence savory description of ${newFoodName.trim()}.",
          "total_nutrition": {
            "calories": <accurate number for ${newFoodName.trim()}>,
            "protein": <accurate number for ${newFoodName.trim()}>,
            "fat": <accurate number for ${newFoodName.trim()}>,
            "carbs": <accurate number for ${newFoodName.trim()}>,
            "fiber": <accurate number for ${newFoodName.trim()}>
          },
          "ingredients": [
            { "name": "ingredient name", "calories": <number> },
            { "name": "ingredient name", "calories": <number> }
          ]
        }
        
        Provide accurate nutrition values for a standard serving size of ${newFoodName.trim()}.
        
        IMPORTANT: Provide realistic fiber values based on the food type:
        - Fruits and vegetables: 2-8g fiber per serving
        - Whole grains and breads: 2-4g fiber per serving  
        - Legumes and beans: 5-15g fiber per serving
        - Nuts and seeds: 2-6g fiber per serving
        - Processed foods: 0-2g fiber per serving
      `;

      console.log('Sending prompt to AI:', prompt);
      const result = await model.generateContent([prompt, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }]);
      const response = await result.response;
      let text = response.text();
      
      console.log('AI Response:', text);
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          console.log('Parsed AI data:', data);
          
          // Update the analysis with new data
          setAnalysis(data);
          
          // Update macros and ingredients
          const newMacros = {
            protein: data?.total_nutrition?.protein || 0,
            carbs: data?.total_nutrition?.carbs || 0,
            fat: data?.total_nutrition?.fat || 0,
            fiber: data?.total_nutrition?.fiber || 0,
          };
          console.log('Setting new macros:', newMacros);
          setMacros(newMacros);
          
          if (data?.ingredients && Array.isArray(data.ingredients)) {
            const newIngredients = data.ingredients.map(item => ({
              name: item?.name || 'Unknown Ingredient',
              amount: '1 serving',
              calories: Math.round(item?.calories || 0),
              icon: getIngredientIcon(item?.name || ''),
            }));
            console.log('Setting new ingredients:', newIngredients);
            setIngredients(newIngredients);
          }
          
          console.log('Food re-analyzed successfully for:', newFoodName);
          
          // Set last updated time
          setLastUpdated(new Date());
          
          // Show success message
          Alert.alert(
            'Nutrition Updated!', 
            `Nutritional information has been updated for "${newFoodName.trim()}"`,
            [{ text: 'OK' }]
          );
      } else {
          throw new Error('Invalid JSON format from API.');
      }

    } catch (error) {
      console.error("Error re-analyzing image:", error);
      // Fallback: just update the name without re-analyzing
      setAnalysis({
        ...analysis,
        dish_name: newFoodName.trim()
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngredientChange = (index, field, value) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const addIngredient = () => {
    setIngredients([...ingredients, {
      name: '',
      amount: '',
      calories: 0,
      icon: '🍽️'
    }]);
  };

  const removeIngredient = (index) => {
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(newIngredients);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top','bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')}>
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Title and Time */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Meal Reflected</Text>
          {isEditing ? (
            <View style={styles.editNameContainer}>
              <TextInput
                style={[styles.mealName, styles.editableText]}
                value={dish_name}
                              onChangeText={(value) => {
                setAnalysis({...analysis, dish_name: value});
                // Trigger re-analysis after a delay to avoid too many API calls
                if (reanalysisTimeoutRef.current) {
                  clearTimeout(reanalysisTimeoutRef.current);
                }
                reanalysisTimeoutRef.current = setTimeout(() => {
                  console.log('Timeout triggered, calling reanalyzeFood with:', value);
                  reanalyzeFood(value);
                }, 2000); // Wait 2 seconds after user stops typing
              }}
              onEndEditing={() => {
                // Also trigger re-analysis when user finishes editing
                console.log('User finished editing, triggering re-analysis for:', dish_name);
                reanalyzeFood(dish_name);
              }}
                placeholder="Enter meal name"
              />
              {isLoading && (
                <View style={styles.reanalysisIndicator}>
                  <ActivityIndicator size={16} color="#7B61FF" />
                  <Text style={styles.reanalysisText}>🔄 Updating nutrition for {dish_name}...</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.testButton}
                onPress={() => {
                  console.log('Current analysis:', analysis);
                  console.log('Current macros:', macros);
                  console.log('Current ingredients:', ingredients);
                  reanalyzeFood(dish_name);
                }}
              >
                <Text style={styles.testButtonText}>🔄 Force Re-analysis</Text>
              </TouchableOpacity>
              {lastUpdated && (
                <Text style={styles.lastUpdatedText}>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.mealName}>{dish_name}</Text>
          )}
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>Today, {getCurrentTime()}</Text>
            <View style={styles.mealTypeTag}>
              <Text style={styles.mealTypeText}>Lunch</Text>
            </View>
          </View>
        </View>

        {/* Meal Image and Calories */}
        <View style={styles.mealImageSection}>
          <View style={styles.mealImageContainer}>
            {/* Left side - Meal Image */}
            <View style={styles.mealImage}>
              <Image
                source={{ uri: photoUri }}
                style={styles.mealImageStyle}
                resizeMode="cover"
              />
            </View>
            
            {/* Right side - Calorie Ring */}
            <View style={styles.calorieRing}>
              <View style={styles.calorieRingInner}>
                <Text style={styles.calorieNumber}>{total_nutrition?.calories || 0}</Text>
                <Text style={styles.calorieLabel}>kcal</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Macros Grid */}
        <View style={styles.macrosGrid}>
          <View style={[styles.macroCard, { backgroundColor: '#FFF2E6' }]}>
            <Text style={styles.macroLabel}>Carbs</Text>
            <View style={styles.macroContent}>
              <Ionicons name="restaurant-outline" size={16} color="#333" />
              {isEditing ? (
                <TextInput
                  style={[styles.macroValue, styles.editableText]}
                  value={Math.round(macros.carbs).toString()}
                  onChangeText={(value) => handleMacroChange('carbs', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.macroValue}>{Math.round(macros.carbs)}g</Text>
              )}
            </View>
          </View>
          <View style={[styles.macroCard, { backgroundColor: '#E6F3FF' }]}>
            <Text style={styles.macroLabel}>Protein</Text>
            <View style={styles.macroContent}>
              <Ionicons name="fitness-outline" size={16} color="#333" />
              {isEditing ? (
                <TextInput
                  style={[styles.macroValue, styles.editableText]}
                  value={Math.round(macros.protein).toString()}
                  onChangeText={(value) => handleMacroChange('protein', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.macroValue}>{Math.round(macros.protein)}g</Text>
              )}
            </View>
          </View>
          <View style={[styles.macroCard, { backgroundColor: '#F0FFE6' }]}>
            <Text style={styles.macroLabel}>Fat</Text>
            <View style={styles.macroContent}>
              <Ionicons name="leaf-outline" size={16} color="#333" />
              {isEditing ? (
                <TextInput
                  style={[styles.macroValue, styles.editableText]}
                  value={Math.round(macros.fat).toString()}
                  onChangeText={(value) => handleMacroChange('fat', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.macroValue}>{Math.round(macros.fat)}g</Text>
              )}
            </View>
          </View>
          <View style={[styles.macroCard, { backgroundColor: '#F3E6FF' }]}>
            <Text style={styles.macroLabel}>Fiber</Text>
            <View style={styles.macroContent}>
              <Ionicons name="nutrition-outline" size={16} color="#333" />
              {isEditing ? (
                <TextInput
                  style={[styles.macroValue, styles.editableText]}
                  value={Math.round(macros.fiber).toString()}
                  onChangeText={(value) => handleMacroChange('fiber', parseFloat(value) || 0)}
                  keyboardType="numeric"
                />
              ) : (
                <Text style={styles.macroValue}>{Math.round(macros.fiber)}g</Text>
              )}
            </View>
          </View>
        </View>

        {/* Health Score */}
        <View style={styles.healthScoreSection}>
          <View style={styles.healthScoreCircle}>
            <Text style={styles.healthScoreNumber}>{calculateHealthScore()}</Text>
          </View>
          <View style={styles.healthScoreInfo}>
            <Text style={styles.healthScoreTitle}>{getHealthText()}</Text>
            <Text style={styles.healthScoreDescription}>{getInfoText()}</Text>
          </View>
          </View>
          
        {/* Ingredients */}
        <View style={styles.ingredientsSection}>
          <View style={styles.ingredientsHeader}>
            <Text style={styles.ingredientsTitle}>Ingredients</Text>
            <View style={styles.ingredientsHeaderRight}>
              <Text style={styles.ingredientsCount}>{ingredients.length} items</Text>
              {isEditing && (
                <TouchableOpacity onPress={addIngredient} style={styles.addIngredientButton}>
                  <Ionicons name="add-circle" size={24} color="#6366F1" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          {ingredients.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
              <Text style={styles.ingredientEmoji}>{ingredient.icon}</Text>
              <View style={styles.ingredientInfo}>
                {isEditing ? (
                  <>
                    <TextInput
                      style={[styles.ingredientName, styles.editableText]}
                      value={ingredient.name}
                      onChangeText={(value) => handleIngredientChange(index, 'name', value)}
                      placeholder="Ingredient name"
                    />
                    <TextInput
                      style={[styles.ingredientAmount, styles.editableText]}
                      value={ingredient.amount}
                      onChangeText={(value) => handleIngredientChange(index, 'amount', value)}
                      placeholder="Amount"
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
                  </>
                )}
              </View>
              <View style={styles.ingredientRight}>
                {isEditing ? (
                  <TextInput
                    style={[styles.ingredientCalories, styles.editableText]}
                    value={ingredient.calories.toString()}
                    onChangeText={(value) => handleIngredientChange(index, 'calories', parseInt(value) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                ) : (
                  <Text style={styles.ingredientCalories}>{ingredient.calories} kcal</Text>
                )}
                {isEditing && (
                  <TouchableOpacity onPress={() => removeIngredient(index)} style={styles.removeIngredientButton}>
                    <Ionicons name="close-circle" size={20} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Mood Selection */}
        <View style={styles.moodSection}>
          <Text style={styles.moodTitle}>How do you feel?</Text>
          <View style={styles.moodOptions}>
            {moodOptions.map((mood, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.moodOption,
                  selectedMood === index && styles.selectedMoodOption
                ]}
                onPress={() => setSelectedMood(index)}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.moodLabels}>
            {moodOptions.map((mood, index) => (
              <Text key={index} style={styles.moodLabel}>{mood.label}</Text>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.editButton} onPress={() => {
          if (isEditing) {
            // When finishing editing, trigger re-analysis immediately
            console.log('Finishing edit, triggering re-analysis for:', dish_name);
            reanalyzeFood(dish_name);
          }
          setIsEditing(!isEditing);
        }}>
          <Text style={styles.editButtonText}>{isEditing ? 'Done' : 'Edit Meal'}</Text>
        </TouchableOpacity>
          
          <View style={styles.bottomButtonsRow}>
            <TouchableOpacity style={styles.saveToMealsButton} onPress={handleSaveToSavedMeals} disabled={isLoading}>
              <Text style={styles.saveToMealsButtonText}>
                {isLoading ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.saveButton} onPress={handleConfirm} disabled={isLoading}>
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Processing...' : 'Log Food'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

     
      
      {/* Error Modal for Non-Food Images */}
      {showErrorModal && (
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModal}>
            <TouchableOpacity 
              style={styles.errorCloseButton}
              onPress={() => {
                setShowErrorModal(false);
                navigation.navigate('MainDashboard');
              }}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={48} color="#ff6b6b" style={styles.errorIcon} />
              <Text style={styles.errorTitle}>Not a Food Item</Text>
              <Text style={styles.errorMessage}>
                This image does not contain actual food items. Please take a photo of real food that you want to log.
              </Text>
            </View>
          </View>
        </View>
      )}
      
      {/* Edit Food Name Modal */}
      {showEditModal && (
        <View style={styles.errorModalOverlay}>
          <View style={styles.errorModal}>
            <TouchableOpacity 
              style={styles.errorCloseButton}
              onPress={() => setShowEditModal(false)}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <View style={styles.errorContent}>
              <Ionicons name="restaurant" size={48} color="#7B61FF" style={styles.errorIcon} />
              <Text style={styles.errorTitle}>Edit Food Name</Text>
              <Text style={styles.errorMessage}>
                Correct the food name if the AI got it wrong. This helps improve future recognition.
              </Text>
              <TextInput
                style={styles.editInput}
                value={editedFoodName}
                onChangeText={setEditedFoodName}
                placeholder="Enter correct food name"
                placeholderTextColor="#999"
                autoFocus={true}
                multiline={false}
              />
              <TouchableOpacity onPress={handleSaveEdit} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
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
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    marginTop: 10, 
    fontSize: 16, 
    color: '#666' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 5,
  },
  titleSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  editNameContainer: {
    marginBottom: 8,
  },
  reanalysisIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  reanalysisText: {
    fontSize: 12,
    color: '#7B61FF',
    fontStyle: 'italic',
  },
  testButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  lastUpdatedText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  editableText: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  mealTypeTag: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mealTypeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mealImageSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  mealImageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mealImage: {
    width: '60%',
    height: 200,
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
    overflow: 'hidden',
  },
  mealImageStyle: {
    width: '100%',
    height: '100%',
  },
  calorieRing: {
    width: 120,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F0F4F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calorieRingInner: {
    alignItems: 'center',
  },
  calorieNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  calorieLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  macroCard: {
    width: '48%', 
    borderRadius: 12,
    padding: 16, // Increased padding for better spacing
    marginBottom: 8,
    flexDirection: 'row', // Change to row layout
    justifyContent: 'space-between', // Space between label and icon+value
    alignItems: 'center', // Center align vertically
  },
  macroLabel: {
    fontSize: 14, // Slightly larger font
    fontWeight: '600',
    color: '#333',
    flex: 1, // Take available space on the left
  },
  macroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Reduced gap between icon and value
  },
  macroValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  healthScoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  healthScoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  healthScoreNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  healthScoreInfo: {
    flex: 1,
  },
  healthScoreTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  healthScoreDescription: {
    fontSize: 14,
    color: '#666',
  },
  ingredientsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  ingredientsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ingredientsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  ingredientsCount: {
    fontSize: 14,
    color: '#666',
  },
  ingredientsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addIngredientButton: {
    padding: 4,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  ingredientEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 1,
  },
  ingredientAmount: {
    fontSize: 12,
    color: '#666',
  },
  ingredientCalories: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeIngredientButton: {
    padding: 2,
  },
  moodSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  moodTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  moodOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  moodOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMoodOption: {
    backgroundColor: '#6366F1',
  },
  moodEmoji: {
    fontSize: 24,
  },
  moodLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  moodLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    width: 60,
  },
  actionButtons: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  saveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    flex: 1,
    marginLeft: 6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12, 
    padding: 15, 
    alignItems: 'center',
  },
  editButtonText: {
    color: '#6366F1',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveToMealsButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  saveToMealsButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  // Error Modal Styles
  errorModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  errorCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  errorContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 16,
    width: '100%',
    backgroundColor: '#f9f9f9',
  },

});

export default PhotoCalorieScreen;