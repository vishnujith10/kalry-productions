import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import supabase from '../lib/supabase';

const PostCalorieScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets(); // Get safe area insets for bottom navigation
  const { analysis, mealName } = route.params || {};
  
  // Add safety checks for route params
  if (!route.params) {
    console.log('No route params found, using defaults');
  }
  
  console.log('PostCalorieScreen - Route params:', route.params);
  console.log('PostCalorieScreen - Analysis:', analysis);
  console.log('PostCalorieScreen - Analysis total:', analysis?.total);
  console.log('PostCalorieScreen - Analysis total_nutrition:', analysis?.total_nutrition);
  
  const [macros, setMacros] = useState({
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [mealNameState, setMealNameState] = useState(analysis?.dish_name || mealName || '');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [logging, setLogging] = useState(false);
  const [selectedMood, setSelectedMood] = useState(null);
  const [macrosLoaded, setMacrosLoaded] = useState(false);
  const [ingredients, setIngredients] = useState([]);

  // Update macros when analysis data changes
  useEffect(() => {
    console.log('useEffect triggered with analysis:', analysis);
    if (analysis) {
      const newMacros = {
        protein: analysis?.total?.protein || analysis?.total_nutrition?.protein || 0,
        carbs: analysis?.total?.carbs || analysis?.total_nutrition?.carbs || 0,
        fat: analysis?.total?.fat || analysis?.total_nutrition?.fat || 0,
        fiber: analysis?.total?.fiber || analysis?.total_nutrition?.fiber || 0,
      };
      console.log('Updating macros with:', newMacros);
      console.log('Fiber value specifically:', newMacros.fiber);
      setMacros(newMacros);
      setMacrosLoaded(true); // Set loaded to true after macros are updated
    } else {
      console.log('No analysis data available');
      setMacrosLoaded(true); // Ensure loaded is true even if no analysis
    }
  }, [analysis]);

  // Debug effect to log macros state changes
  useEffect(() => {
    console.log('Macros state changed to:', macros);
    console.log('Current fiber value:', macros.fiber);
  }, [macros]);

  // Calculate dynamic health score based on food data and user profile
  const calculateHealthScore = () => {
    const { calories, protein, carbs, fat, fiber } = analysis?.total || analysis?.total_nutrition || {};
    
    if (!calories || calories === 0) return { score: 0, text: 'No Data', info: 'No nutritional data available' };
    
    let score = 0; // Start from 0 for more realistic scoring
    
    // Protein balance (ideal: 20-30% of calories)
    const proteinCalories = protein * 4;
    const proteinPercentage = (proteinCalories / calories) * 100;
    if (proteinPercentage >= 20 && proteinPercentage <= 30) score += 3; // Excellent protein
    else if (proteinPercentage >= 15 && proteinPercentage <= 35) score += 2; // Good protein
    else if (proteinPercentage >= 10 && proteinPercentage <= 40) score += 1; // Fair protein
    else if (proteinPercentage < 10) score -= 1; // Very low protein
    
    // Carb balance (ideal: 45-65% of calories)
    const carbCalories = carbs * 4;
    const carbPercentage = (carbCalories / calories) * 100;
    if (carbPercentage >= 45 && carbPercentage <= 65) score += 2.5; // Excellent carbs
    else if (carbPercentage >= 35 && carbPercentage <= 75) score += 1.5; // Good carbs
    else if (carbPercentage >= 25 && carbPercentage <= 85) score += 0.5; // Fair carbs
    else if (carbPercentage > 85) score -= 1; // Too many carbs
    
    // Fat balance (ideal: 20-35% of calories)
    const fatCalories = fat * 9;
    const fatPercentage = (fatCalories / calories) * 100;
    if (fatPercentage >= 20 && fatPercentage <= 35) score += 2; // Excellent fat
    else if (fatPercentage >= 15 && fatPercentage <= 40) score += 1; // Good fat
    else if (fatPercentage >= 10 && fatPercentage <= 45) score += 0.5; // Fair fat
    else if (fatPercentage > 45) score -= 1; // Too much fat
    else if (fatPercentage < 10) score -= 0.5; // Too little fat
    
    // Fiber content (good: >10g per meal)
    if (fiber >= 10) score += 1.5; // Excellent fiber
    else if (fiber >= 7) score += 1; // Good fiber
    else if (fiber >= 5) score += 0.5; // Fair fiber
    else if (fiber >= 3) score += 0; // Low fiber
    else score -= 0.5; // Very low fiber
    
    // Calorie appropriateness (assuming 2000 cal daily, ~600-700 per meal)
    if (calories >= 400 && calories <= 800) score += 1; // Good calorie range
    else if (calories >= 300 && calories <= 1000) score += 0.5; // Acceptable range
    else if (calories < 200 || calories > 1200) score -= 1; // Poor range
    
    // Cap score between 0 and 10
    score = Math.max(0, Math.min(10, score));
    
    // Determine health text
    let healthText = 'Poor';
    if (score >= 8) healthText = 'Excellent';
    else if (score >= 6) healthText = 'Good';
    else if (score >= 4) healthText = 'Balanced';
    else if (score >= 2) healthText = 'Fair';
    
    // Generate info text based on actual macro percentages
    let infoText = '';
    
    // Protein feedback
    if (proteinPercentage >= 20 && proteinPercentage <= 30) {
      infoText += 'Excellent protein balance. ';
    } else if (proteinPercentage >= 15 && proteinPercentage <= 35) {
      infoText += 'Good protein content. ';
    } else if (proteinPercentage >= 10 && proteinPercentage <= 40) {
      infoText += 'Fair protein content. ';
    } else if (proteinPercentage < 10) {
      infoText += 'Low protein content. ';
    } else {
      infoText += 'High protein content. ';
    }
    
    // Fat feedback
    if (fatPercentage >= 20 && fatPercentage <= 35) {
      infoText += 'Good fat balance. ';
    } else if (fatPercentage >= 15 && fatPercentage <= 40) {
      infoText += 'Acceptable fat content. ';
    } else if (fatPercentage > 45) {
      infoText += 'High in fats. ';
    } else if (fatPercentage < 10) {
      infoText += 'Low fat content. ';
    } else {
      infoText += 'Moderate fat content. ';
    }
    
    // Fiber feedback
    if (fiber >= 10) {
      infoText += `Excellent fiber content (${fiber}g).`;
    } else if (fiber >= 7) {
      infoText += `Good fiber content (${fiber}g).`;
    } else if (fiber >= 5) {
      infoText += `Fair fiber content (${fiber}g).`;
    } else if (fiber >= 3) {
      infoText += `Low fiber content (${fiber}g).`;
    } else {
      infoText += `Very low fiber content (${fiber}g).`;
    }
    
    return { score: Math.round(score * 10) / 10, text: healthText, info: infoText };
  };

  const healthData = calculateHealthScore();
  const healthScore = healthData.score;
  const healthText = healthData.text;
  const infoText = healthData.info;

  // Helper function to get appropriate icon for ingredients
  const getIngredientIcon = (ingredientName) => {
    const name = ingredientName.toLowerCase();
    if (name.includes('rice') || name.includes('pasta') || name.includes('bread')) return '🍚';
    if (name.includes('chicken') || name.includes('meat') || name.includes('fish')) return '🍗';
    if (name.includes('vegetable') || name.includes('greens') || name.includes('salad')) return '🥬';
    if (name.includes('fruit') || name.includes('apple') || name.includes('banana')) return '🍎';
    if (name.includes('juice')) return '🧃';
    if (name.includes('egg')) return '🥚';
    if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt')) return '🥛';
    if (name.includes('nut') || name.includes('seed')) return '🥜';
    if (name.includes('oil') || name.includes('butter') || name.includes('fat')) return '🫒';
    return '🍽️'; // default icon
  };

  // Helper function to extract main ingredients from meal name
  const extractMainIngredients = (mealName) => {
    console.log('extractMainIngredients called with:', mealName);
    const name = mealName.toLowerCase();
    console.log('Lowercase meal name:', name);
    const ingredients = [];
    
    // Indian dishes
    if (name.includes('dosa')) {
      console.log('Found dosa in meal name');
      ingredients.push({ name: 'Dosa', amount: '1 piece', icon: '🥞' });
      if (name.includes('masala')) {
        console.log('Found masala in meal name');
        ingredients.push({ name: 'Potato Masala', amount: '100g', icon: '🥔' });
      }
      if (name.includes('sambar')) {
        ingredients.push({ name: 'Sambar', amount: '50ml', icon: '🥘' });
      }
      if (name.includes('chutney')) {
        ingredients.push({ name: 'Chutney', amount: '30ml', icon: '🥗' });
      }
    }
    else if (name.includes('idli')) {
      ingredients.push({ name: 'Idli', amount: '2-3 pieces', icon: '🥞' });
      if (name.includes('sambar')) {
        ingredients.push({ name: 'Sambar', amount: '100ml', icon: '🥘' });
      }
      if (name.includes('chutney')) {
        ingredients.push({ name: 'Chutney', amount: '50ml', icon: '🥗' });
      }
    }
    else if (name.includes('biryani')) {
      ingredients.push({ name: 'Basmati Rice', amount: '200g', icon: '🍚' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '150g', icon: '🍗' });
      } else if (name.includes('mutton')) {
        ingredients.push({ name: 'Mutton', amount: '150g', icon: '🥩' });
      } else if (name.includes('vegetable') || name.includes('veg')) {
        ingredients.push({ name: 'Mixed Vegetables', amount: '100g', icon: '🥬' });
      }
      ingredients.push({ name: 'Biryani Spices', amount: '10g', icon: '🌶️' });
    }
    else if (name.includes('curry')) {
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken Curry', amount: '200g', icon: '🍗' });
      } else if (name.includes('dal') || name.includes('lentil')) {
        ingredients.push({ name: 'Dal Curry', amount: '200g', icon: '🟡' });
      } else if (name.includes('vegetable') || name.includes('veg')) {
        ingredients.push({ name: 'Vegetable Curry', amount: '200g', icon: '🥬' });
      } else {
        ingredients.push({ name: 'Curry', amount: '200g', icon: '🥘' });
      }
      ingredients.push({ name: 'Rice', amount: '150g', icon: '🍚' });
    }
    else if (name.includes('paratha')) {
      ingredients.push({ name: 'Paratha', amount: '2 pieces', icon: '🫓' });
      if (name.includes('aloo')) {
        ingredients.push({ name: 'Potato Filling', amount: '100g', icon: '🥔' });
      }
      if (name.includes('paneer')) {
        ingredients.push({ name: 'Paneer Filling', amount: '80g', icon: '🧀' });
      }
    }
    else if (name.includes('roti') || name.includes('chapati')) {
      ingredients.push({ name: 'Roti/Chapati', amount: '2-3 pieces', icon: '🫓' });
      if (name.includes('dal')) {
        ingredients.push({ name: 'Dal', amount: '150ml', icon: '🟡' });
      }
      if (name.includes('sabzi') || name.includes('vegetable')) {
        ingredients.push({ name: 'Vegetable Sabzi', amount: '100g', icon: '🥬' });
      }
    }
    
    // Western dishes
    else if (name.includes('burger')) {
      ingredients.push({ name: 'Burger Bun', amount: '1 piece', icon: '🍞' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken Patty', amount: '120g', icon: '🍗' });
      } else if (name.includes('beef')) {
        ingredients.push({ name: 'Beef Patty', amount: '120g', icon: '🥩' });
      } else if (name.includes('veg')) {
        ingredients.push({ name: 'Veggie Patty', amount: '100g', icon: '🥬' });
      } else {
        ingredients.push({ name: 'Patty', amount: '120g', icon: '🥩' });
      }
      ingredients.push({ name: 'Vegetables & Sauce', amount: '50g', icon: '🥗' });
    }
    else if (name.includes('pizza')) {
      ingredients.push({ name: 'Pizza Base', amount: '2-3 slices', icon: '🍕' });
      if (name.includes('cheese')) {
        ingredients.push({ name: 'Cheese', amount: '60g', icon: '🧀' });
      }
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken Toppings', amount: '80g', icon: '🍗' });
      }
      if (name.includes('vegetable') || name.includes('veg')) {
        ingredients.push({ name: 'Vegetable Toppings', amount: '60g', icon: '🥬' });
      }
    }
    else if (name.includes('pasta')) {
      ingredients.push({ name: 'Pasta', amount: '150g', icon: '🍝' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '100g', icon: '🍗' });
      }
      if (name.includes('sauce') || name.includes('tomato')) {
        ingredients.push({ name: 'Pasta Sauce', amount: '80ml', icon: '🥫' });
      }
      if (name.includes('cheese')) {
        ingredients.push({ name: 'Cheese', amount: '40g', icon: '🧀' });
      }
    }
    else if (name.includes('sandwich')) {
      ingredients.push({ name: 'Bread', amount: '2 slices', icon: '🍞' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '100g', icon: '🍗' });
      } else if (name.includes('veg')) {
        ingredients.push({ name: 'Vegetables', amount: '80g', icon: '🥬' });
      }
      if (name.includes('cheese')) {
        ingredients.push({ name: 'Cheese', amount: '30g', icon: '🧀' });
      }
    }
    
    // Asian dishes
    else if (name.includes('noodles') || name.includes('chow mein')) {
      ingredients.push({ name: 'Noodles', amount: '150g', icon: '🍜' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '100g', icon: '🍗' });
      }
      if (name.includes('vegetable') || name.includes('veg')) {
        ingredients.push({ name: 'Mixed Vegetables', amount: '80g', icon: '🥬' });
      }
    }
    else if (name.includes('fried rice')) {
      ingredients.push({ name: 'Rice', amount: '200g', icon: '🍚' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '80g', icon: '🍗' });
      }
      if (name.includes('egg')) {
        ingredients.push({ name: 'Egg', amount: '1 piece', icon: '🥚' });
      }
      ingredients.push({ name: 'Mixed Vegetables', amount: '60g', icon: '🥬' });
    }
    else if (name.includes('sushi')) {
      ingredients.push({ name: 'Sushi Rice', amount: '100g', icon: '🍚' });
      if (name.includes('salmon')) {
        ingredients.push({ name: 'Salmon', amount: '50g', icon: '🐟' });
      } else if (name.includes('tuna')) {
        ingredients.push({ name: 'Tuna', amount: '50g', icon: '🐟' });
      }
      ingredients.push({ name: 'Nori & Vegetables', amount: '20g', icon: '🥗' });
    }
    
    // Generic patterns - only if no specific dish found
    else if (name.includes('rice') && !ingredients.length) {
      ingredients.push({ name: 'Rice', amount: '200g', icon: '🍚' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken', amount: '120g', icon: '🍗' });
      }
    }
    else if (name.includes('chicken') && !ingredients.length) {
      ingredients.push({ name: 'Chicken', amount: '150g', icon: '🍗' });
      if (name.includes('rice')) {
        ingredients.push({ name: 'Rice', amount: '150g', icon: '🍚' });
      }
    }
    else if (name.includes('salad') && !ingredients.length) {
      ingredients.push({ name: 'Mixed Salad Greens', amount: '150g', icon: '🥬' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Grilled Chicken', amount: '100g', icon: '🍗' });
      }
      ingredients.push({ name: 'Salad Dressing', amount: '30ml', icon: '🥗' });
    }
    else if (name.includes('soup') && !ingredients.length) {
      ingredients.push({ name: 'Soup', amount: '300ml', icon: '🥣' });
      if (name.includes('chicken')) {
        ingredients.push({ name: 'Chicken Pieces', amount: '80g', icon: '🍗' });
      }
      if (name.includes('vegetable')) {
        ingredients.push({ name: 'Mixed Vegetables', amount: '60g', icon: '🥬' });
      }
    }
    else if (name.includes('juice') && !ingredients.length) {
      if (name.includes('orange')) {
        ingredients.push({ name: 'Orange Juice', amount: '250ml', icon: '🍊' });
      } else if (name.includes('apple')) {
        ingredients.push({ name: 'Apple Juice', amount: '250ml', icon: '🍎' });
      } else if (name.includes('mango')) {
        ingredients.push({ name: 'Mango Juice', amount: '250ml', icon: '🥭' });
      } else {
        ingredients.push({ name: 'Fruit Juice', amount: '250ml', icon: '🧃' });
      }
    }
    
    return ingredients;
  };

  // Initialize ingredients from analysis
  useEffect(() => {
    const initializeIngredients = () => {
      try {
        console.log('Analysis data:', analysis);
        console.log('Analysis items:', analysis?.items);
        
        // First, try to get ingredients from analysis
        if (analysis?.items && Array.isArray(analysis.items) && analysis.items.length > 0) {
          // Check if items are complete dishes (like "1 chicken sandwich") or ingredients
          const firstItem = analysis.items[0];
          const isCompleteDish = firstItem?.name && (
            firstItem.name.includes('sandwich') || 
            firstItem.name.includes('burger') || 
            firstItem.name.includes('pizza') || 
            firstItem.name.includes('juice') ||
            firstItem.name.includes('salad') ||
            firstItem.name.includes('soup') ||
            firstItem.name.includes('pasta') ||
            firstItem.name.includes('rice')
          );
          
          if (isCompleteDish) {
            // If items are complete dishes, extract ingredients from meal name instead
            const mealNameToUse = mealNameState || analysis?.dish_name || 'Meal';
            const mainIngredients = extractMainIngredients(mealNameToUse);
            if (mainIngredients.length > 0) {
              const totalCalories = analysis?.total?.calories || analysis?.total_nutrition?.calories || 0;
              const caloriesPerIngredient = Math.round(totalCalories / mainIngredients.length);
              
              const newIngredients = mainIngredients.map((ingredient, index) => ({
                name: ingredient.name,
                amount: ingredient.amount,
                calories: index === mainIngredients.length - 1 ? 
                  totalCalories - (caloriesPerIngredient * (mainIngredients.length - 1)) : 
                  caloriesPerIngredient,
                icon: ingredient.icon,
              }));
              setIngredients(newIngredients);
              return;
            }
          } else {
            // If items are actual ingredients, use them directly
            const newIngredients = analysis.items.map(item => ({
              name: item?.name || 'Unknown Ingredient',
              amount: item?.quantity || '1 serving',
              calories: Math.round(item?.calories || 0),
              icon: getIngredientIcon(item?.name || ''),
            }));
            setIngredients(newIngredients);
            return;
          }
        }
        
        // If no analysis items, extract main ingredients from meal name
        const mealNameToUse = mealNameState || analysis?.dish_name || 'Meal';
        const totalCalories = analysis?.total?.calories || analysis?.total_nutrition?.calories || 0;
        
        console.log('Meal name for ingredients:', mealNameToUse);
        console.log('Total calories:', totalCalories);
        
        // Extract main ingredients from meal name
        const mainIngredients = extractMainIngredients(mealNameToUse);
        console.log('Extracted main ingredients:', mainIngredients);
        
        if (mainIngredients.length > 0) {
          console.log('Using extracted main ingredients');
          // Distribute calories among main ingredients proportionally
          const caloriesPerIngredient = Math.round(totalCalories / mainIngredients.length);
          
          const newIngredients = mainIngredients.map((ingredient, index) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            calories: index === mainIngredients.length - 1 ? 
              totalCalories - (caloriesPerIngredient * (mainIngredients.length - 1)) : 
              caloriesPerIngredient,
            icon: ingredient.icon
          }));
          setIngredients(newIngredients);
          return;
        }
        
        // Final fallback - only if no main ingredients could be extracted
        console.log('Using final fallback ingredient');
        setIngredients([{
          name: mealNameToUse || 'Complete Meal',
          amount: '1 serving',
          calories: totalCalories,
          icon: '🍽️'
        }]);
        
      } catch (error) {
        console.log('Error processing ingredients:', error);
        setIngredients([{ 
          name: 'Complete Meal', 
          amount: '1 serving', 
          calories: analysis?.total_nutrition?.calories || 0, 
          icon: '🍽️' 
        }]);
      }
    };
    
    initializeIngredients();
  }, [analysis, mealNameState]);

  const moodOptions = [
    { emoji: '😀', label: 'Happy' },
    { emoji: '😊', label: 'Content' },
    { emoji: '😐', label: 'Neutral' },
    { emoji: '😞', label: 'Sad' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '😤', label: 'Stressed' },
  ];

  // Block back navigation
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => true;
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [])
  );

  const handleMacroChange = (key, value) => {
    setMacros({ ...macros, [key]: value });
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

  const validateMealName = () => {
    if (!mealNameState || mealNameState.trim().length < 2) {
      setNameError('Meal name must be at least 2 characters');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleSave = async () => {
    if (!validateMealName()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');
      const { calories } = analysis?.total || analysis?.total_nutrition || {};
      const { protein, carbs, fat, fiber } = macros;
      const { description } = analysis || {};
      
      // Check if we have a photo to upload (from PhotoCalorieScreen)
      let photoUrl = null;
      if (route?.params?.photoUri) {
        try {
          const fileName = `food-photos/${user.id}/${Date.now()}.jpg`;
          
          // Convert photo URI to ArrayBuffer for upload (works on RN/Expo)
          const response = await fetch(route.params.photoUri);
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
          user_id: user.id,
          dish_name: mealNameState,
          description: description || '',
          calories: calories || 0,
          protein: protein || 0,
          carbs: carbs || 0,
          fat: fat || 0,
          fiber: fiber || 0,
          photo_url: photoUrl,
        },
      ]);
      if (error) throw error;
      Alert.alert('Success', 'Meal saved successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('SavedMealsScreen'),
        },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDone = async () => {
    if (!validateMealName()) return;
    setLogging(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');
      const { calories } = analysis?.total || analysis?.total_nutrition || {};
      const { protein, carbs, fat, fiber } = macros;
      const cleanFoodName = mealNameState.replace(/^You said:\s*/i, '');
      
      // Get selected mood emoji
      const selectedMoodEmoji = selectedMood !== null ? moodOptions[selectedMood].emoji : null;
      
      // Check if we have a photo to upload (from PhotoCalorieScreen)
      let photoUrl = null;
      if (route?.params?.photoUri) {
        try {
          const fileName = `food-photos/${user.id}/${Date.now()}.jpg`;
          
          // Convert photo URI to ArrayBuffer for upload (works on RN/Expo)
          const response = await fetch(route.params.photoUri);
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
      
      const logData = {
        user_id: user.id,
        food_name: cleanFoodName,
        serving_size: 1,
        calories: calories || 0,
        carbs: carbs || 0,
        protein: protein || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        mood: selectedMoodEmoji,
        photo_url: photoUrl,
        date_time: new Date().toISOString().split('T')[0],
        meal_type: 'Quick Log',
        notes: '',
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('user_food_logs').insert([logData]);
      if (error) throw error;
      
      // Optimistic cache update (Instagram pattern)
      const { updateMainDashboardCacheOptimistic, updateHomeScreenCacheOptimistic } = require('../utils/cacheManager');
      updateMainDashboardCacheOptimistic(logData);
      updateHomeScreenCacheOptimistic(logData);
      
      Alert.alert('Success', 'Food logged successfully!');
      navigation.navigate('Home');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLogging(false);
    }
  };



  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

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
                 source={{ uri: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop' }}
            style={styles.photo}
                 resizeMode="cover"
               />
             </View>
             
        {/* Food Name */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Identified Food</Text>
            <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
              <Ionicons name="pencil-outline" size={20} color="#7B61FF" />
            </TouchableOpacity>
               </View>
              {isEditing ? (
                <TextInput
              style={[styles.foodName, styles.editableText]}
              value={mealNameState}
              onChangeText={setMealNameState}
              placeholder="Enter food name"
                />
              ) : (
            <Text style={styles.foodName}>{mealNameState || analysis?.dish_name || 'Meal'}</Text>
              )}
          <Text style={styles.confidence}>
            Confidence: 85%
          </Text>
            </View>

        {/* Nutrition Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{analysis?.total?.calories || analysis?.total_nutrition?.calories || 0}</Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
          </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.protein)}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
          </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.carbs)}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
          </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>{Math.round(macros.fat)}g</Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
        </View>
          </View>
        </View>

        {/* Ingredients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients Detected</Text>
          {ingredients.map((ingredient, index) => (
            <View key={index} style={styles.ingredientItemRow}>
              <View style={styles.ingredientDot} />
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientNameText}>{ingredient.name}</Text>
                <Text style={styles.ingredientQuantity}>{ingredient.amount}</Text>
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
          onPress={handleSave}
          disabled={saving}
        >
          <Ionicons name="bookmark-outline" size={20} color="#7B61FF" />
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Meal'}
              </Text>
            </TouchableOpacity>
            
        <TouchableOpacity 
          style={styles.confirmButton} 
          onPress={handleDone}
          disabled={logging}
        >
          <Text style={styles.confirmButtonText}>
                {logging ? 'Logging...' : 'Log Food'}
              </Text>
          </TouchableOpacity>
          </View>
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
    borderRadius: 20,
  },
  calorieRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#F0F4F8',
  },
  calorieRingInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  calorieLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroIcon: {
    marginRight: 8,
  },
  macroLabel: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  healthScoreInfo: {
    flex: 1,
  },
  healthScoreTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  healthScoreDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  ingredientsCount: {
    fontSize: 12,
    color: '#666',
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
  editableText: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  ingredientsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addIngredientButton: {
    padding: 4,
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeIngredientButton: {
    padding: 2,
  },
  // Photo container styles (matching PhotoCalorieScreen)
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
  // Section styles (matching PhotoCalorieScreen)
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
  // Nutrition grid styles (matching PhotoCalorieScreen)
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
  // Ingredient row styles (matching PhotoCalorieScreen)
  ingredientItemRow: {
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
  ingredientNameText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  // Mood grid styles (matching PhotoCalorieScreen)
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  selectedMood: {
    backgroundColor: '#E8E4FF',
    borderWidth: 2,
    borderColor: '#7B61FF',
  },
  moodOption: {
    width: '30%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    fontSize: 12,
    color: '#666',
  },
  // Action container styles (matching PhotoCalorieScreen)
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
});

export default PostCalorieScreen; 