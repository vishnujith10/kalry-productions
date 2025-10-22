import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Button, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import supabase from '../lib/supabase';
import { getDailyGoal, setDailyGoal } from '../utils/goalStorage';
import useTodaySteps from '../utils/useTodaySteps';

// Remove MOCK_STEPS, use real steps

// PERCENT will be calculated from real steps
const WEEKLY = [0.6, 0.67, 0.6, 0.5, 0.8, 1, 0.55];
const STATS = [
  { icon: 'time-outline', label: 'Active Time', value: '58', unit: 'min' },
  { icon: 'walk', label: 'Distance', value: '5.6', unit: 'km' },
  { icon: 'flame', label: 'Calories', value: '280', unit: 'kcal' },
];
const connectedApps = [
  {
    name: 'Apple Health',
    icon: <FontAwesome5 name="apple" size={20} color="#222" />,
    status: 'Connected',
    statusColor: '#1abc9c',
  },
  {
    name: 'Google Fit',
    icon: <FontAwesome5 name="google" size={20} color="#222" />,
    status: 'Connected',
    statusColor: '#1abc9c',
  },
  {
    name: 'Fit Con',
    icon: <MaterialCommunityIcons name="fit-to-screen" size={20} color="#222" />,
    status: 'Not Connected',
    statusColor: '#888',
  },
];


const StepTrackerScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [goal, setGoal] = useState(10000);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [newGoal, setNewGoal] = useState(10000);
  const { stepsToday, isPedometerAvailable, distanceKm, calories } = useTodaySteps();
  const [weeklySteps, setWeeklySteps] = useState([0,0,0,0,0,0,0]);

  // All useEffect, handlers, and logic here
  useEffect(() => {
    const getUserId = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    getUserId();
  }, []);

  useEffect(() => {
    if (!userId) return;
    getDailyGoal(userId).then(setGoal);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    fetch('https://wdkraevjbcguvwpxscqf.supabase.co/functions/v1/steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date: dateStr, steps: stepsToday }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('Steps upserted to backend:', data);
      })
      .catch(err => {
        console.log('Error upserting steps to backend:', err);
      });
  }, [stepsToday, userId]);

  useEffect(() => {
    if (!userId) return;
    // Fetch last 7 days of steps
    const fetchWeeklySteps = async () => {
      try {
        const res = await fetch(`https://wdkraevjbcguvwpxscqf.supabase.co/functions/v1/steps/${userId}`);
        const data = await res.json();
        // Build a map of date string to steps
        const stepsMap = {};
        data.forEach(log => { stepsMap[log.date] = log.steps; });
        // Get last 7 days (Sun-Sat)
        const week = [];
        const today = new Date();
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - today.getDay());
        for (let i = 0; i < 7; i++) {
          const d = new Date(sunday);
          d.setDate(sunday.getDate() + i);
          const dateStr = d.toISOString().slice(0,10);
          week.push(stepsMap[dateStr] || 0);
        }
        setWeeklySteps(week);
      } catch (err) {
        setWeeklySteps([0,0,0,0,0,0,0]);
      }
    };
    fetchWeeklySteps();
  }, [userId]);

  useEffect(() => {
    console.log('stepsToday:', stepsToday, 'isPedometerAvailable:', isPedometerAvailable);
  }, [stepsToday, isPedometerAvailable]);

  const handleSaveGoal = async () => {
    console.log('Save button pressed', { userId, newGoal });
    if (!userId) {
      alert('No user ID!');
      return;
    }
    const success = await setDailyGoal(userId, newGoal);
    console.log('setDailyGoal result:', success);
    if (success) {
      setGoal(newGoal);
      setShowGoalModal(false);
      alert('Goal updated!');
    } else {
      alert('Failed to save goal. Please try again.');
    }
  };

  const openGoalModal = () => {
    setNewGoal(goal);
    setShowGoalModal(true);
  };

  const percent = Math.round((stepsToday / goal) * 100);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F7FC' }}>
      {/* Custom Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step Tracker</Text>
        <View style={{ width: 40 }} />
      </View>
      
      <ScrollView style={{ flex: 1, backgroundColor: '#F8F7FC' }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#444', marginBottom: 18 }}>Keep moving forward!</Text>
      {/* Removed debug: Show if pedometer is available */}
      {/* Removed warning about step sensor not available */}
      {Platform.OS === 'android' && (
        <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 14, color: '#e67e22', marginBottom: 4 }}>
          Step count only updates while app is open (Android limitation in Expo Go)
        </Text>
      )}
      {/* Circular Progress */}
      <View style={{ alignItems: 'center', marginBottom: 10 }}>
        <View style={styles.circleOuter}>
          <View style={styles.circleInner}>
            <MaterialCommunityIcons name="walk" size={32} color="#A084E8" style={{ marginBottom: 2 }} />
            <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 32, color: '#222' }}>{stepsToday.toLocaleString()}</Text>
            <Text style={{ fontFamily: 'Lexend-Regular', fontSize: 16, color: '#888' }}>/ {goal.toLocaleString()} steps</Text>
          </View>
          <View style={[styles.progressArc, { transform: [{ rotate: `${(percent / 100) * 360 - 90}deg` }] }]} />
        </View>
        <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#7C3AED', marginTop: 10 }}>{percent}% of daily goal</Text>
        <TouchableOpacity style={styles.syncBtn}><Text style={styles.syncBtnText}>Sync Steps</Text></TouchableOpacity>
      </View>

      {/* Stat Cards Row - minimal design */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, marginTop: 15, }}>
        {/* Calories Burnt Card */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginRight: 8, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <View>
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#222' }}>Calories</Text>
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#222' }}>Burnt</Text>
            </View>
            <Ionicons name="flame-outline" size={20} color="#2E5C4D" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 32, color: '#222', lineHeight: 36 }}>{calories.toFixed(0)}</Text>
            <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 18, color: '#2E5C4D', marginLeft: 4, marginBottom: 2 }}>kCal</Text>
          </View>
        </View>
        {/* Distance Covered Card */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginLeft: 8, alignItems: 'flex-start' }}>
          <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <View>
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#222' }}>Distance</Text>
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 16, color: '#222' }}>Covered</Text>
            </View>
            <Ionicons name="walk" size={20} color="#2E5C4D" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 32, color: '#222', lineHeight: 36 }}>{distanceKm.toFixed(2)}</Text>
            <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 18, color: '#2E5C4D', marginLeft: 4, marginBottom: 2 }}>KM</Text>
          </View>
        </View>
      </View>
      {/* Daily Goal */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            shadowColor: '#181A20',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
            flex: 1,
            marginRight: 10,
            justifyContent: 'center',
          }}
          onPress={openGoalModal}
          activeOpacity={0.9}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 14, color: '#888' }}>Your daily goal</Text>
              <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 20, color: '#7C3AED', marginTop: 2 }}>
                {goal.toLocaleString()} steps
              </Text>
            </View>

            <TouchableOpacity onPress={openGoalModal} style={{
              backgroundColor: '#F4EBFF',
              borderRadius: 10,
              padding: 8,
            }}>
              <MaterialCommunityIcons name="pencil" size={18} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.25)',
          padding: 24,
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderRadius: 20,
            padding: 24,
            width: '100%',
            maxWidth: 340,
          }}>
            <Text style={{
              fontFamily: 'Lexend-Bold',
              fontSize: 18,
              marginBottom: 16,
              color: '#222'
            }}>Set Daily Step Goal</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              {[5000, 7500, 10000].map(opt => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setNewGoal(opt)}
                  style={{
                    backgroundColor: newGoal === opt ? '#7C3AED' : '#F4F4F5',
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Lexend-SemiBold',
                    fontSize: 14,
                    color: newGoal === opt ? '#fff' : '#333'
                  }}>
                    {opt.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={{ borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8, marginTop: 12, fontSize: 16 }}
              keyboardType="numeric"
              value={String(newGoal)}
              onChangeText={text => setNewGoal(Number(text.replace(/[^0-9]/g, '')))}
              placeholder="Custom goal"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setShowGoalModal(false)} />
              <View style={{ width: 12 }} />
              <Button title="Save" onPress={handleSaveGoal} />
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.progressCard}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontFamily: 'Lexend-Bold', fontSize: 16, color: '#222', flex: 1 }}>
            Weekly Progress
          </Text>
          <TouchableOpacity style={styles.weekBtn}>
            <Text style={styles.weekBtnText}>Week</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>Month</Text>
          </TouchableOpacity>
        </View>

        {/* Graph Layout */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160 }}>
          {/* Y-Axis Step Levels */}
          <View style={{ justifyContent: 'space-between', height: '100%', marginRight: 10 }}>
            {[10000, 8000, 6000, 4000, 2000, 0].map((val) => (
              <Text
                key={val}
                style={{
                  fontFamily: 'Manrope-Regular',
                  fontSize: 12,
                  color: '#aaa',
                }}
              >
                {val / 1000}k
              </Text>
            ))}
          </View>

          {/* Bars (bottom-up growth) */}
          <View
            style={{
              flexDirection: 'row',
              flex: 1,
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
              const progress = goal > 0 ? Math.min(1, weeklySteps[i] / goal) : 0;
              const barHeight = 130 * progress;
              const opacity = 0.25 + 0.75 * progress;
              return (
                <View key={day + i} style={{ alignItems: 'center', flex: 1 }}>
                  <View
                    style={{
                      height: 130,
                      justifyContent: 'flex-end', // Align bar to bottom
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: barHeight,
                        backgroundColor: '#A084E8',
                        borderRadius: 8,
                        opacity,
                      }}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: 'Manrope-Regular',
                      fontSize: 13,
                      color: '#888',
                      marginTop: 6,
                    }}
                  >
                    {day}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope-Regular', fontSize: 12, color: '#222', marginTop: 2 }}>{weeklySteps[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>


      {/* Connected Apps Card */}
      <View style={{ padding: 5, borderRadius: 18 }}>
        <Text style={{ fontFamily: 'Lexend-semibold', fontSize: 18, color: '#222', marginBottom: 16 }}>
          Connected Apps
        </Text>

        {connectedApps.map((app, index) => (
          <TouchableOpacity key={index} style={styles.appCard}>
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>{app.icon}</View>

              <View style={{ flex: 1 }}>
                <Text style={styles.appName}>{app.name}</Text>
                <Text style={[styles.appStatus, { color: app.statusColor }]}>{app.status}</Text>
              </View>

              {/* Status Dot */}
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: app.statusColor },
                ]}
              />
            </View>
          </TouchableOpacity>
        ))}

        {/* Add App Button */}
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Connect New App</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const CIRCLE_SIZE = 180;
const styles = StyleSheet.create({
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F8F7FC',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    fontFamily: 'Lexend-Bold',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  circleOuter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 12,
    borderColor: '#2E1A47',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',

    // iOS Dark Glow
    shadowColor: 'rgba(72, 58, 112, 0.6)', // Dark violet glow
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40, // More blur

    // Android Dark Glow
    elevation: 24,
    backgroundColor: '#2E1A47', // Required for Android shadow
  },
  circleInner: {
    width: CIRCLE_SIZE - 24,
    height: CIRCLE_SIZE - 24,
    borderRadius: (CIRCLE_SIZE) / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    left: 1,
    zIndex: 2,
  },
  progressArc: {
    position: 'absolute',
    width: CIRCLE_SIZE + 2,
    height: CIRCLE_SIZE - 30,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 12,
    borderColor: '#A084E8',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    zIndex: 1,
  },
  syncBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 16,
  },
  syncBtnText: {
    color: '#fff',
    fontFamily: 'Lexend-Bold',
    fontSize: 16,
  },
  appCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
  },
  appName: {
    fontFamily: 'Lexend-Bold',
    fontSize: 15,
    color: '#222',
  },
  appStatus: {
    fontFamily: 'Manrope-Regular',
    fontSize: 13,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  addButton: {
    backgroundColor: '#1abc9c',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  addButtonText: {
    fontFamily: 'Lexend-Bold',
    fontSize: 15,
    color: '#fff',
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  weekBtn: {
    backgroundColor: '#E5DFFB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginLeft: 8,
  },
  weekBtnText: {
    color: '#7C3AED',
    fontFamily: 'Lexend-Bold',
    fontSize: 14,
  },
  monthBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginLeft: 4,
  },
  monthBtnText: {
    color: '#888',
    fontFamily: 'Lexend-Bold',
    fontSize: 14,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginRight: 10,
    alignItems: 'center',
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  goalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    marginBottom: 18,
    shadowColor: '#181A20',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  goalContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalLabel: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    color: '#888',
    marginBottom: 2,
  },
  goalValue: {
    fontFamily: 'Lexend-Bold',
    fontSize: 18,
    color: '#7C3AED',
  },

});

export default StepTrackerScreen; 