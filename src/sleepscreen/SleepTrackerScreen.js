import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useContext, useEffect, useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { OnboardingContext } from "../context/OnboardingContext";
import supabase from "../lib/supabase";
import { getResponsivePadding } from '../utils/responsive';

const SLEEP_QUALITIES = ["Excellent", "Good", "Fair", "Poor"];
const MOODS = ["Relaxed", "Neutral", "Tired", "Stressed"];

// Global cache for sleep data
const globalSleepCache = {
  cachedData: null,
  timestamp: null,
  isStale: false,
  CACHE_DURATION: 5000, // 5 seconds
};
const SLEEP_TIPS = [
  "Avoid caffeine and alcohol before bed, and consider light exercise during the day to promote better sleep.",
  "Limit screen time an hour before bed — the blue light can trick your brain into thinking it's daytime.",
  "Try gentle stretches or breathing exercises to relax your body before sleep.",
  "Keep your bedroom reserved for rest — avoid working or scrolling in bed.",
  "Use calming rituals like journaling, reading, or listening to soothing music before sleep.",
  "If you can't fall asleep within 20 minutes, get up and do a calming activity until you feel drowsy.",
  "Expose yourself to natural sunlight during the day — it helps regulate your body's sleep-wake cycle.",
  "Avoid heavy meals right before bed, but a light snack (like fruit or warm milk) can help if you're hungry.",
  "Keep naps short (20–30 minutes) and avoid napping late in the day.",
  "Maintain a comfortable sleep environment — supportive mattress, breathable bedding, and good airflow.",
  "Create a 'worry list' earlier in the day so your mind feels clearer at night.",
  "Practice gratitude journaling or reflection before bed to end the day with calm thoughts.",
  "Try mindfulness or meditation techniques to quiet a racing mind.",
  "Stick to a wind-down ritual — doing the same actions nightly signals your body it's time to sleep.",
  "Keep your sleep space free of clutter for a calmer, more restful atmosphere.",
  "Stay hydrated during the day, but reduce fluid intake right before bedtime to avoid sleep interruptions.",
  "Avoid checking the clock repeatedly at night — it creates stress and makes falling asleep harder.",
  "Experiment with aromatherapy (lavender, chamomile) to set a calming mood.",
  "Respect your body's natural rhythm — if you're consistently sleepy earlier, adjust your bedtime gradually.",
];

function getWeekDates() {
  const today = new Date();
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    week.push(d);
  }
  return week;
}

const SleepTrackerScreen = () => {
  const navigation = useNavigation();
  const { onboardingData } = useContext(OnboardingContext);
  
  // Initialize with cached data
  const [sleepLogs, setSleepLogs] = useState(() => globalSleepCache.cachedData || []);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const [lastSleep, setLastSleep] = useState(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [quality, setQuality] = useState("Good");
  const [mood, setMood] = useState("Relaxed");
  const [weekData, setWeekData] = useState([]);
  const [tipsIdx, setTipsIdx] = useState(0);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [sleepPhoto, setSleepPhoto] = useState(null);
  const [appleHealthSynced, setAppleHealthSynced] = useState(false);
  const [bedtimeReminder, setBedtimeReminder] = useState("22:30");
  const [wakeReminder, setWakeReminder] = useState("06:45");
  const [showBedtimeReminderPicker, setShowBedtimeReminderPicker] =
    useState(false);
  const [showWakeReminderPicker, setShowWakeReminderPicker] = useState(false);
  const [sleepGoal, setSleepGoal] = useState(8); // default 8 hours
  const [isLoadingGoal, setIsLoadingGoal] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [showAlreadyLoggedModal, setShowAlreadyLoggedModal] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force recalculation
  const [showSleepGoalModal, setShowSleepGoalModal] = useState(false);
  const [tempSleepGoal, setTempSleepGoal] = useState(8);

  function computeHoursBetween(startHHMM, endHHMM) {
    if (!startHHMM || !endHHMM) return null;
    const [sh, sm] = startHHMM.split(":").map((n) => parseInt(n, 10) || 0);
    const [eh, em] = endHHMM.split(":").map((n) => parseInt(n, 10) || 0);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // across midnight
    return Math.max(0, Math.round(mins / 60)); // keep goal as integer hours
  }

  // Recalculate goal from reminders whenever they change
  useEffect(() => {
    const derived = computeHoursBetween(bedtimeReminder, wakeReminder);
    if (derived && derived !== sleepGoal) {
      setSleepGoal(derived);
      // Persist for consistency
      saveSleepGoal(derived);
    }
  }, [bedtimeReminder, wakeReminder]);

  const [realUserId, setRealUserId] = useState(null);
  
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => setRealUserId(user?.id));
  }, []);

  // Helper to get today's date string in local timezone
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  };

  // Cache-first data fetching with useFocusEffect
  useFocusEffect(
    useCallback(() => {
      if (!realUserId) return;

      const now = Date.now();
      const isCacheValid = globalSleepCache.timestamp && 
        (now - globalSleepCache.timestamp) < globalSleepCache.CACHE_DURATION;

      // If cache is fresh, use it and skip fetch
      if (isCacheValid && globalSleepCache.cachedData) {
        setSleepLogs(globalSleepCache.cachedData);
        setLastSleep(globalSleepCache.cachedData?.[0] || null);
        return;
      }

      // If cache is stale, use it immediately but fetch fresh data
      if (globalSleepCache.cachedData && globalSleepCache.isStale) {
        setSleepLogs(globalSleepCache.cachedData);
        setLastSleep(globalSleepCache.cachedData?.[0] || null);
      }

      // Fetch fresh data
      fetchSleepLogs();
      fetchSleepGoal();
    }, [realUserId])
  );

  // Monitor sleep logs changes for week data updates
  useEffect(() => {
    if (sleepLogs.length > 0) {
      // Prepare week data
      const week = getWeekDates();
      const weekMap = {};
      sleepLogs.forEach((log) => {
        const logDate = getDateOnly(log.date);
        weekMap[logDate] = log; 
      });
      setWeekData(
        week.map((d) => weekMap[d.toISOString().slice(0, 10)] || null)
      );
    }
  }, [sleepLogs, refreshTrigger]);

  // Auto-expand current month when "View all" is clicked
  useEffect(() => {
    if (showAllLogs && sleepLogs.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      setExpandedMonths((prev) => {
        const newSet = new Set(prev);
        newSet.add(currentMonth);
        return newSet;
      });
    }
  }, [showAllLogs, sleepLogs]);

  // Cache-first fetch function
  async function fetchSleepLogs() {
    if (!realUserId || isFetching) return;
    
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("sleep_logs")
        .select("*")
        .eq("user_id", realUserId)
        .order("date", { ascending: false });

      if (error) {
        console.log("Error fetching sleep logs:", error);
        return;
      }

      // Filter out any logs with invalid or empty duration
      const validData = (data || []).filter((log) => {
        if (!log || !log.duration) return false;
        const mins = parseIntervalToMinutes(log.duration);
        return mins > 0;
      });

      // Update cache
      globalSleepCache.cachedData = validData;
      globalSleepCache.timestamp = Date.now();
      globalSleepCache.isStale = false;

      // Only update state if data has changed
      const currentDataString = JSON.stringify(sleepLogs);
      const newDataString = JSON.stringify(validData);
      
      if (currentDataString !== newDataString) {
        setSleepLogs(validData);
        setLastSleep(validData?.[0] || null);
        
        // Prepare week data
        const week = getWeekDates();
        const weekMap = {};
        validData.forEach((log) => {
          const logDate = getDateOnly(log.date);
          weekMap[logDate] = log; 
        });
        setWeekData(
          week.map((d) => weekMap[d.toISOString().slice(0, 10)] || null)
        );
      }
    } catch (err) {
      console.log("Error fetching sleep logs:", err);
    } finally {
      setIsFetching(false);
    }
  }

  // NEW: Fetch user's saved sleep goal from database
  async function fetchSleepGoal() {
    if (!realUserId) return;
    try {
      // First try to get the goal from the most recent sleep log
      const { data: recentLog, error: recentError } = await supabase
        .from("sleep_logs")
        .select("sleep_goal")
        .eq("user_id", realUserId)
        .not("sleep_goal", "is", null)
        .order("date", { ascending: false })
        .limit(1);

      if (recentError) {
        console.log("Error fetching recent sleep goal:", recentError);
        return;
      }

      if (recentLog && recentLog.length > 0 && recentLog[0].sleep_goal) {
        setSleepGoal(recentLog[0].sleep_goal);
      } else {
        setSleepGoal(8);
      }

      setIsLoadingGoal(false);
    } catch (err) {
      console.log("Error fetching sleep goal:", err);
      setIsLoadingGoal(false);
    }
  }

  // NEW: Save sleep goal to database
  async function saveSleepGoal(newGoal) {
    if (!realUserId) return;
    try {
      // Update the most recent sleep log with the new goal
      const { data: recentLog, error: recentError } = await supabase
        .from("sleep_logs")
        .select("id")
        .eq("user_id", realUserId)
        .order("date", { ascending: false })
        .limit(1);

      if (recentError) {
        console.log("Error fetching recent log for goal update:", recentError);
        return;
      }

      if (recentLog && recentLog.length > 0) {
        // Update existing log with new goal
        const { error: updateError } = await supabase
          .from("sleep_logs")
          .update({ sleep_goal: newGoal })
          .eq("id", recentLog[0].id);

        if (updateError) {
          console.log("Error updating sleep goal:", updateError);
        }
      } else {
        // Create a new log entry with the goal if no logs exist
        const { error: insertError } = await supabase
          .from("sleep_logs")
          .insert([
            {
              user_id: realUserId,
              date: getTodayString(),
              sleep_goal: newGoal,
              start_time: null,
              end_time: null,
              duration: null,
              quality: null,
              mood: null,
            },
          ]);

        if (insertError) {
          console.log("Error creating sleep goal entry:", insertError);
        }
      }
    } catch (err) {
      console.log("Error saving sleep goal:", err);
    }
  }

  // Handle sleep goal update
  const handleSleepGoalUpdate = async () => {
    if (tempSleepGoal < 1 || tempSleepGoal > 24) {
      Alert.alert("Invalid Goal", "Sleep goal must be between 1 and 24 hours");
      return;
    }
    
    setSleepGoal(tempSleepGoal);
    await saveSleepGoal(tempSleepGoal);
    setShowSleepGoalModal(false);
  };

  async function handleAddSleep() {
    if (!realUserId || !startTime || !endTime) {
      Alert.alert("Missing info", "Please select both start and end time.");
      return;
    }
    
    // Calculate duration as string
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    const duration = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:00`;
    
    // Fixed logic for date assignment
    let logDate = new Date();
    
    // Only adjust date if sleep clearly crosses midnight
    if (sh > eh || (sh === eh && sm > em)) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour < eh || (currentHour === eh && currentMinute < em)) {
        logDate.setDate(logDate.getDate() - 1);
      }
    }
    
    const dateStr = logDate.toISOString().slice(0, 10);
    
    // Check for existing log for this date
    const existingLog = sleepLogs.find(
      (l) => getDateOnly(l.date) === dateStr && l.user_id === realUserId
    );
    if (!editMode && existingLog) {
      setShowAlreadyLoggedModal(true);
      return;
    }

    try {
      let error;
      if (editMode && editingLogId) {
        // Update existing log
        ({ error } = await supabase
          .from("sleep_logs")
          .update({
          start_time: startTime,
          end_time: endTime,
          duration,
          quality,
          mood,
          })
          .eq("id", editingLogId));
      } else {
        // Insert new log
        ({ error } = await supabase.from("sleep_logs").insert([
          {
          user_id: realUserId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          duration,
          quality,
          mood,
            sleep_goal: sleepGoal, // Include the current sleep goal
          },
        ]));
      }
      
      if (error) throw error;
      
      // Optimistic update - update global cache immediately
      const newLog = {
        id: editingLogId || `temp_${Date.now()}`,
        user_id: realUserId,
        date: dateStr,
        start_time: startTime,
        end_time: endTime,
        duration,
        quality,
        mood,
        sleep_goal: sleepGoal,
      };

      // Update global cache optimistically
      if (editMode && editingLogId) {
        // Update existing log in cache
        const updatedLogs = globalSleepCache.cachedData?.map(log => 
          log.id === editingLogId ? { ...log, ...newLog } : log
        ) || [];
        globalSleepCache.cachedData = updatedLogs;
      } else {
        // Add new log to cache
        const updatedLogs = [newLog, ...(globalSleepCache.cachedData || [])];
        globalSleepCache.cachedData = updatedLogs;
      }
      
      // Update local state immediately
      setSleepLogs(globalSleepCache.cachedData);
      setLastSleep(globalSleepCache.cachedData?.[0] || null);

      // Update MainDashboard cache
      try {
        const { updateMainDashboardSleepCache } = require('../utils/cacheManager');
        updateMainDashboardSleepCache({
          date: dateStr,
          duration,
          quality,
          mood,
          sleep_goal: sleepGoal,
        });
      } catch (error) {
        // Silent - cacheManager might not exist yet
      }
      
      Alert.alert(
        "Success",
        editMode ? "Sleep log updated!" : "Sleep log added!"
      );
      
      // Clear form and close modal
      setStartTime("");
      setEndTime("");
      setQuality("Good");
      setMood("Relaxed");
      setEditMode(false);
      setEditingLogId(null);
      setShowLogModal(false);
      
      // Mark cache as stale to trigger refresh on next focus
      globalSleepCache.isStale = true;
      
      // Force recalculation of consistency
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const photo = result.assets[0];
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;
      const fileExt = photo.uri.split(".").pop();
      const fileName = `sleep_${userId}_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("sleep-photos")
        .upload(fileName, {
        uri: photo.uri,
          type: "image/jpeg",
        name: fileName,
      });
      if (!error && data?.path) {
        const publicUrl = supabase.storage
          .from("sleep-photos")
          .getPublicUrl(data.path).publicUrl;
        setSleepPhoto(publicUrl);
      }
    }
  }

  function formatDurationString(duration) {
    if (!duration) return "--";
    const hMatch = duration.match(/(\d+)\s*hour/);
    const mMatch = duration.match(/(\d+)\s*minute/);
    const h = hMatch ? parseInt(hMatch[1]) : 0;
    const m = mMatch ? parseInt(mMatch[1]) : 0;
    if (h && m) return `${h}h ${m}m`;
    if (h) return `${h}h`;
    if (m) return `${m}m`;
    return "--";
  }

  function formatTime12h(time) {
    if (!time) return "";
    let [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  // Helper to normalize date string (handles 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:MM:SSZ')
  function getDateOnly(str) {
    return str ? str.slice(0, 10) : "";
  }

  // Helper to convert interval (e.g., '08:30:00') to '8h 30m' (robust)
  function parseIntervalToDisplay(interval) {
    if (!interval || typeof interval !== "string") return "--";
    const clean = interval.trim();
    if (!clean.includes(":")) return "--";
    const parts = clean.split(":");
    if (parts.length < 2) return "--";
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    if (h === 0 && m === 0) return "--";
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return "--";
  }

  // Helper to convert interval to total minutes (robust)
  function parseIntervalToMinutes(interval) {
    if (!interval || typeof interval !== "string") return 0;
    const clean = interval.trim();
    if (!clean.includes(":")) return 0;
    const parts = clean.split(":");
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }

  // Helper to group logs by month
  function groupLogsByMonth(logs) {
    const grouped = {};

    logs.forEach((log) => {
      const date = new Date(log.date);
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;
      const monthName = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName,
          logs: [],
          isCurrentMonth: false,
        };
      }
      grouped[monthKey].logs.push(log);
    });

    // Sort months in descending order (most recent first)
    const sortedMonths = Object.values(grouped).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );

    // Mark current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    sortedMonths.forEach((month) => {
      month.isCurrentMonth = month.monthKey === currentMonth;
    });

    return sortedMonths;
  }

  // Helper to toggle month expansion
  function toggleMonthExpansion(monthKey) {
    setExpandedMonths((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  }

  // Calculate average sleep duration from sleepLogs
  function getAverageSleepDuration(logs) {
    if (!logs || logs.length === 0) {
      return "--";
    }

    // Filter out logs with valid duration data AND only consider very recent logs (today or yesterday)
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const recentValidLogs = logs.filter((log) => {
      if (!log || !log.duration) {
        return false;
      }

      // Check if log is from today or yesterday only
      const logDate = new Date(log.date);
      const isToday = logDate.toDateString() === today.toDateString();
      const isYesterday = logDate.toDateString() === yesterday.toDateString();
      const isRecent = isToday || isYesterday;

      if (!isRecent) {
        return false;
      }

      const mins = parseIntervalToMinutes(log.duration);
      return mins > 0;
    });

    if (recentValidLogs.length === 0) {
      return "--";
    }

    let totalMinutes = 0;
    recentValidLogs.forEach((log) => {
      const mins = parseIntervalToMinutes(log.duration);
      totalMinutes += mins;
    });

    const avg = Math.round(totalMinutes / recentValidLogs.length);
    const avgH = Math.floor(avg / 60);
    const avgM = avg % 60;

    let result;
    if (avgH > 0 && avgM > 0) result = `${avgH}h ${avgM}m`;
    else if (avgH > 0) result = `${avgH}h`;
    else if (avgM > 0) result = `${avgM}m`;
    else result = "--";

    return result;
  }

  // *FIXED*: Get today's log and calculate metrics properly
  const todayStr = getTodayString();
  const todayLog = sleepLogs.find(
    (l) => getDateOnly(l.date) === todayStr && l.user_id === realUserId
  );


  let todayDuration = "--";
  let todayMinutes = 0;
  let todayPercent = 0;
  let hitGoal = false;

  if (todayLog && todayLog.duration) {
    todayDuration = parseIntervalToDisplay(todayLog.duration);
    todayMinutes = parseIntervalToMinutes(todayLog.duration);
    todayPercent =
      sleepGoal > 0
        ? Math.min(100, Math.round((todayMinutes / (sleepGoal * 60)) * 100))
        : 0;
    hitGoal = todayMinutes >= sleepGoal * 60;
  }

  const averageSleep = getAverageSleepDuration(sleepLogs);

  // *FIXED*: Get latest log's bedtime and wake time
  let displayBedtime = "--:--";
  let displayWakeTime = "--:--";
  
  if (todayLog) {
    displayBedtime = todayLog.start_time
      ? formatTime12h(todayLog.start_time)
      : "--:--";
    displayWakeTime = todayLog.end_time
      ? formatTime12h(todayLog.end_time)
      : "--:--";
  }

  // Helper to get week days in order Mon-Sun
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekDateObjs = [];
  const today = new Date();
  const monday = new Date(today);
  // Get the most recent Monday (if today is Monday, use today)
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so subtract 6 to get Monday
  monday.setDate(today.getDate() - daysToSubtract);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDateObjs.push(d);
  }

  // Map weekData by date string for lookup
  const weekLogMap = {};
  sleepLogs.forEach((log) => {
    weekLogMap[getDateOnly(log.date)] = log; 
  });


  // Weekly consistency: percentage of days that met sleep goal
  const weekTotalMins = weekDateObjs.reduce((sum, d) => {
    const key = d.toISOString().slice(0, 10);
    const log = weekLogMap[key];
    const mins = log && log.duration ? parseIntervalToMinutes(log.duration) : 0;
    return sum + mins;
  }, 0);
  
  // Calculate consistency as percentage of days that met sleep goal
  const daysWithLogs = weekDateObjs.filter(d => {
    const key = d.toISOString().slice(0, 10);
    const log = weekLogMap[key];
    const hasLog = log && log.duration && parseIntervalToMinutes(log.duration) > 0;
    return hasLog;
  }).length;
  
  const daysMetGoal = weekDateObjs.filter(d => {
    const key = d.toISOString().slice(0, 10);
    const log = weekLogMap[key];
    if (!log || !log.duration) return false;
    const mins = parseIntervalToMinutes(log.duration);
    const goalMins = sleepGoal * 60;
    const metGoal = mins >= (goalMins * 0.7); // Lowered to 70% of goal to be more reasonable
    return metGoal;
  }).length;
  
  // Calculate consistency as average percentage of goal achieved (same as MainDashboard)
  let weekConsistencyPercent = 0;
  
  if (daysWithLogs === 0) {
    weekConsistencyPercent = 0;
  } else {
    // Calculate average percentage of goal achieved across all days with logs
    const totalGoalPercent = weekDateObjs.reduce((sum, d) => {
      const key = d.toISOString().slice(0, 10);
      const log = weekLogMap[key];
      if (!log || !log.duration) return sum;
      
      const mins = parseIntervalToMinutes(log.duration);
      const goalMins = sleepGoal * 60;
      const dayPercent = goalMins > 0 ? Math.min(100, Math.round((mins / goalMins) * 100)) : 0;
      return sum + dayPercent;
    }, 0);
    
    weekConsistencyPercent = Math.round(totalGoalPercent / daysWithLogs);
  }
  
  // Ensure the percentage is valid
  const validConsistencyPercent = isNaN(weekConsistencyPercent) ? 0 : Math.max(0, Math.min(100, weekConsistencyPercent));


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Sleep Tracker</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Last Night's Sleep Card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 10,
            marginBottom: 20,
            shadowColor: "#000",
            shadowOpacity: 0.08,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "#F3E8FF",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 18,
            }}
          >
            <Ionicons name="moon-outline" size={32} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text 
              style={{ 
                color: "#9CA3AF", 
                fontSize: 15, 
                
                fontWeight: "500",
                letterSpacing: 0.3,
              }}
            >
              Last Night's Sleep
            </Text>
            <Text
              style={{ 
                fontWeight: "700", 
                fontSize: 25, 
                color: "#1F2937",
                letterSpacing: -1,
              }}
            >
              {todayDuration}
            </Text>
            <Text 
              style={{ 
                color: "#9CA3AF", 
                fontSize: 14,
                fontWeight: "500",
              }}
            >
              {(() => {
                if (!todayLog || !todayLog.duration) return "No data";
                
                // Get yesterday's log
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().slice(0, 10);
                const yesterdayLog = sleepLogs.find(
                  (l) => getDateOnly(l.date) === yesterdayStr && l.user_id === realUserId
                );
                
                if (!yesterdayLog || !yesterdayLog.duration) return "No data loged yesterday";
                
                // Calculate percentages
                const todayMins = parseIntervalToMinutes(todayLog.duration);
                const yesterdayMins = parseIntervalToMinutes(yesterdayLog.duration);
                
                if (yesterdayMins === 0) return "No yesterday data";
                
                const percentage = Math.round(((todayMins - yesterdayMins) / yesterdayMins) * 100);
                const sign = percentage >= 0 ? "+" : "";
                
                return `${sign}${percentage}% vs yesterday`;
              })()}
            </Text>
          </View>
        </View>

        {/* Weekly Chart */}
        <Text
          style={{
            fontWeight: "800",
            fontSize: 20,
            color: "#111827",
            marginBottom: 10,
            marginLeft: 4,
          }}
        >
          Weekly Chart
        </Text>
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
              height: 140,
            }}
          >
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => {
              const dayDate = weekDateObjs[idx];
              const key = dayDate.toISOString().slice(0, 10);
              const log = weekLogMap[key];
              const mins =
                log && log.duration ? parseIntervalToMinutes(log.duration) : 0;
              const progress =
                sleepGoal > 0 ? Math.min(1, mins / (sleepGoal * 60)) : 0;
              const filled = 120 * progress;
              const hours = Math.floor(mins / 60);
              const minutes = mins % 60;
              const timeDisplay =
                mins > 0
                  ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`
                  : "--";

              return (
                <View key={key} style={{ alignItems: "center", width: 32 }}>
                  <View
                    style={{
                      width: 22,
                      height: 120,
                      borderRadius: 12,
                      backgroundColor: "#E5E7EB",
                      overflow: "hidden",
                      justifyContent: "flex-end",
                      position: "relative",
                    }}
                  >
                    {filled > 0 ? (
                      <LinearGradient
                        colors={["#C4B5FD", "#A7F3D0"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{ width: "100%", height: filled }}
                      />
                    ) : (
                      <View
                        style={{
                          width: "100%",
                          height: 120,
                          backgroundColor: "#F3F4F6",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      ></View>
                    )}
          </View>
                  <Text
                    style={{ color: "#6B7280", fontSize: 12, marginTop: 6 }}
                  >
                    {d}
                  </Text>
          </View>
              );
            })}
          </View>
          {weekTotalMins === 0 && (
            <View style={{ alignItems: "center", marginTop: 10, padding: 10 }}>
              <Text
                style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center" }}
              >
                No sleep data for this week yet. Log your sleep to see the
                chart!
              </Text>
            </View>
          )}
        </View>

        {/* Sleep Log header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontWeight: "800",
              fontSize: 18,
              color: "#111827",
              marginLeft: 4,
            }}
          >
            Sleep Log
          </Text>
          <TouchableOpacity
              onPress={() => setShowAllLogs(!showAllLogs)}
              style={{
                backgroundColor: "#F3F4F6",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 16,
              }}
            >
              <Text style={{ color: "#111827", fontWeight: "700" }}>
                {showAllLogs ? "Show recent" : "View all"}
              </Text>
          </TouchableOpacity>
        </View>

        {/* Sleep Log cards */}
        {(() => {
          const moodToEmoji = (m) => {
            if (!m) return "😴";
            const map = {
              Relaxed: "😌",
              Neutral: "🙂",
              Tired: "🥱",
              Stressed: "😫",
            };
            return map[m] || "😴";
          };

          const formatDateLabel = (dateStr) => {
            const date = new Date(dateStr);
            const today = new Date();

            // Only show "Today" if the log is from today
            if (date.toDateString() === today.toDateString()) {
              return "Today";
            } else {
              return date.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            }
          };

          const Item = ({ log }) => {
            return (
              <View
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  shadowColor: "#000",
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontWeight: "700",
                        color: "#111827",
                        fontSize: 16,
                      }}
                    >
                      {formatDateLabel(log.date)}
                    </Text>
                    <Text style={{ color: "#6B7280", marginTop: 4 }}>
                      {`${formatTime12h(log.start_time)} - ${formatTime12h(
                        log.end_time
                      )}`}
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontWeight: "800",
                      color: "#7C3AED",
                      fontSize: 16,
                    }}
                  >
                    {parseIntervalToDisplay(log.duration)}{" "}
                    {moodToEmoji(log.mood)}
                  </Text>
                </View>
              </View>
            );
          };

          if (!showAllLogs) {
            // Show last 3 actual sleep logs
            const recentLogs = sleepLogs.slice(0, 3);
            return (
              <>
                {recentLogs.map((log, idx) => (
                  <Item key={log.id} log={log} />
                ))}
              </>
            );
          } else {
            // Show hierarchical month-based view
            const groupedMonths = groupLogsByMonth(sleepLogs);

            return (
              <>
                {groupedMonths.map((month, monthIndex) => {
                  const isExpanded = expandedMonths.has(month.monthKey);

                  return (
                    <View key={month.monthKey}>
                      {/* Current month is always shown */}
                      {month.isCurrentMonth && (
                        <>
                          <Text
                            style={{
                              fontWeight: "800",
                              fontSize: 18,
                              color: "#111827",
                              marginBottom: 12,
                              marginTop: 8,
                            }}
                          >
                            {month.monthName}
                          </Text>
                          {month.logs.map((log) => (
                            <Item key={log.id} log={log} />
                          ))}
                        </>
                      )}

                      {/* Previous months with expand/collapse */}
                      {!month.isCurrentMonth && (
                        <>
                          {/* Month header with expand/collapse button */}
                          <TouchableOpacity
                            onPress={() => toggleMonthExpansion(month.monthKey)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                              backgroundColor: "#F8F9FA",
                              borderRadius: 12,
                              padding: 12,
                              marginBottom: 8,
                              marginTop: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontWeight: "700",
                                fontSize: 16,
                                color: "#111827",
                              }}
                            >
                              {month.monthName}
                            </Text>
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  color: "#6B7280",
                                  fontSize: 14,
                                  marginRight: 8,
                                }}
                              >
                                {month.logs.length} log
                                {month.logs.length !== 1 ? "s" : ""}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 18,
                                  color: "#6B7280",
                                  transform: [
                                    { rotate: isExpanded ? "180deg" : "0deg" },
                                  ],
                                }}
                              >
                                ⌄
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* Expanded month logs */}
                          {isExpanded && (
                            <>
                              {month.logs.map((log) => (
                                <Item key={log.id} log={log} />
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </View>
                  );
                })}
              </>
            );
          }
        })()}

        {/* Tip card */}
        <View
          style={{
            backgroundColor: "#F3E8FF",
            borderRadius: 16,
            padding: 16,
            marginTop: 8,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "#6B21A8" }}>
            You slept <Text style={{ fontWeight: "800" }}>{averageSleep}</Text>{" "}
            on average this week. Try keeping your bedtime consistent for better
            results.
          </Text>
        </View>

        {/* Time Pickers remain below */}
        {showFromPicker && (
          <DateTimePicker
            value={
              startTime ? new Date(`1970-01-01T${startTime}:00`) : new Date()
            }
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, date) => {
              setShowFromPicker(false);
              if (date) {
                const h = date.getHours().toString().padStart(2, "0");
                const m = date.getMinutes().toString().padStart(2, "0");
                setStartTime(`${h}:${m}`);
              }
            }}
          />
        )}
        {showToPicker && (
          <DateTimePicker
            value={endTime ? new Date(`1970-01-01T${endTime}:00`) : new Date()}
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, date) => {
              setShowToPicker(false);
              if (date) {
                const h = date.getHours().toString().padStart(2, "0");
                const m = date.getMinutes().toString().padStart(2, "0");
                setEndTime(`${h}:${m}`);
              }
            }}
          />
        )}

        {/* Sleep Goal Card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 18,
            marginBottom: 18,
            shadowColor: "#1F2937",
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.2)",
          }}
        >
          {/* Sleep Goal Card */}
          <TouchableOpacity
            onPress={() => {
              setTempSleepGoal(sleepGoal);
              setShowSleepGoalModal(true);
            }}
            style={{
              backgroundColor: "#FAFAFB",
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: "#E2E8F0",
              shadowColor: "#000",
              shadowOpacity: 0.03,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              marginBottom: 16,
            }}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <LinearGradient
                colors={["#8B5CF6", "#A78BFA"]}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Text style={{ fontSize: 18 }}>💤</Text>
              </LinearGradient>
              <View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#1E293B",
                    marginBottom: 2,
                  }}
                >
                  Set Sleep Goal
                </Text>
                <Text
                  style={{
                    fontSize: 12, 
                    color: "#64748B",
                  }}
                >
                  Personalize your target
                </Text>
              </View>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: "#F0F9FF",
                borderWidth: 1,
                borderColor: "#E0F2FE",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: "#0369A1",
                }}
              >
                {todayPercent}% of {sleepGoal}h
              </Text>
            </View>
          </TouchableOpacity>

          {/* Reminder Cards */}
          <View style={{ gap: 16 }}>
            {/* Bedtime Reminder */}
            <TouchableOpacity
              onPress={() => setShowBedtimeReminderPicker(true)}
              style={{
                backgroundColor: "#FAFAFB",
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                shadowColor: "#000",
                shadowOpacity: 0.03,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <LinearGradient
                  colors={["#4F46E5", "#7C3AED"]}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Text style={{ fontSize: 18 }}>🌙</Text>
                </LinearGradient>
                <View>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: "#1E293B",
                    marginBottom: 2,
                    }}
                  >
                    Bedtime Reminder
                  </Text>
                  <Text
                    style={{
                    fontSize: 12, 
                      color: "#64748B",
                    }}
                  >
                    Wind down notification
                  </Text>
                </View>
              </View>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: "#F0F9FF",
                borderWidth: 1,
                  borderColor: "#E0F2FE",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#0369A1",
                  }}
                >
                  {bedtimeReminder}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Wake-up Alarm */}
            <TouchableOpacity
              onPress={() => setShowWakeReminderPicker(true)}
              style={{
                backgroundColor: "#FAFAFB",
                borderRadius: 24,
                paddingVertical: 18,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                borderWidth: 1,
                borderColor: "#E2E8F0",
                shadowColor: "#000",
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <LinearGradient
                  colors={["#F59E0B", "#EAB308"]}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 14,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>⏰</Text>
                </LinearGradient>
                <View>
                  <Text
                    style={{
                    fontSize: 16, 
                      fontWeight: "600",
                      color: "#1E293B",
                    marginBottom: 2,
                    }}
                  >
                    Wake-up Alarm
                  </Text>
                  <Text
                    style={{
                    fontSize: 12, 
                      color: "#64748B",
                    }}
                  >
                    Start your day right
                  </Text>
                </View>
              </View>
              <View
                style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 16,
                  backgroundColor: "#FEF3C7",
                borderWidth: 1,
                  borderColor: "#FDE68A",
                }}
              >
                <Text
                  style={{
                  fontSize: 15, 
                    fontWeight: "700",
                    color: "#92400E",
                  }}
                >
                  {wakeReminder}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>


        {/* Log Sleep Button */}
        <TouchableOpacity 
          style={{ 
            backgroundColor: "#4F46E5",
            borderRadius: 16, 
            paddingVertical: 16, 
            alignItems: "center",
          }} 
          onPress={() => {
            const existingLog = sleepLogs.find(
              (l) =>
                getDateOnly(l.date) === todayStr && l.user_id === realUserId
            );
            if (existingLog) {
              setShowAlreadyLoggedModal(true);
            } else {
              setEditMode(false);
              setEditingLogId(null);
              setShowLogModal(true);
            }
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}>
            Log Your Sleep
          </Text>
        </TouchableOpacity>

        {/* Already Logged Modal */}
        <Modal
          visible={showAlreadyLoggedModal}
          animationType="fade"
          transparent
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.2)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                width: "85%",
              }}
            >
              <Text
                style={{
                  fontWeight: "bold",
                  fontSize: 20,
                  marginBottom: 18,
                  textAlign: "center",
                }}
              >
                Sleep already logged
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  color: "#374151",
                  marginBottom: 24,
                  textAlign: "center",
                }}
              >
                You have already logged your sleep for today.
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity 
                  onPress={() => setShowAlreadyLoggedModal(false)} 
                  style={{ 
                    flex: 1, 
                    backgroundColor: "#E5E7EB",
                    borderRadius: 12, 
                    padding: 14, 
                    alignItems: "center",
                    marginRight: 8,
                  }}
                >
                  <Text
                    style={{
                      color: "#374151",
                      fontWeight: "bold",
                      fontSize: 16,
                    }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    const log = sleepLogs.find(
                      (l) =>
                        getDateOnly(l.date) === todayStr &&
                        l.user_id === realUserId
                    );
                    if (log) {
                      setStartTime(log.start_time);
                      setEndTime(log.end_time);
                      setQuality(log.quality || "Good");
                      setMood(log.mood || "Relaxed");
                      setEditMode(true);
                      setEditingLogId(log.id);
                      setShowLogModal(true);
                    }
                    setShowAlreadyLoggedModal(false);
                  }} 
                  style={{ 
                    flex: 1, 
                    backgroundColor: "#4F46E5",
                    borderRadius: 12, 
                    padding: 14, 
                    alignItems: "center",
                    marginLeft: 8,
                  }}
                >
                  <Text
                    style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}
                  >
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Log Sleep Modal */}
        <Modal visible={showLogModal} animationType="slide" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.2)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 20,
                padding: 24,
                width: "90%",
              }}
            >
              <Text
                style={{ fontWeight: "bold", fontSize: 20, marginBottom: 18 }}
              >
                {editMode ? "Edit Your Sleep" : "Log Your Sleep"}
              </Text>
              
              {/* Start Time Picker */}
              <TouchableOpacity 
                onPress={() => setShowFromPicker(true)} 
                style={{ 
                  marginBottom: 12, 
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#F3F4F6",
                  borderRadius: 12, 
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 16, color: "#374151" }}>Bedtime</Text>
                <Text
                  style={{ fontSize: 16, color: "#3B82F6", fontWeight: "600" }}
                >
                  {startTime || "--:--"}
                </Text>
              </TouchableOpacity>
              
              {/* End Time Picker */}
              <TouchableOpacity 
                onPress={() => setShowToPicker(true)} 
                style={{ 
                  marginBottom: 12, 
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: "#F3F4F6",
                  borderRadius: 12, 
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 16, color: "#374151" }}>Wake-up</Text>
                <Text
                  style={{ fontSize: 16, color: "#3B82F6", fontWeight: "600" }}
                >
                  {endTime || "--:--"}
                </Text>
              </TouchableOpacity>
              
              {/* Quality Picker */}
              <View style={{ marginBottom: 12 }}>
                <Text
                  style={{ fontSize: 16, color: "#374151", marginBottom: 6 }}
                >
                  Sleep Quality
                </Text>
                <View style={{ flexDirection: "row" }}>
                  {SLEEP_QUALITIES.map((q) => (
                    <TouchableOpacity 
                      key={q} 
                      onPress={() => setQuality(q)} 
                      style={{ 
                        backgroundColor: quality === q ? "#6366F1" : "#F3F4F6",
                        borderRadius: 8, 
                        paddingVertical: 8, 
                        paddingHorizontal: 14, 
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: quality === q ? "#fff" : "#374151",
                          fontWeight: "600",
                        }}
                      >
                        {q}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Mood Picker */}
              <View style={{ marginBottom: 18 }}>
                <Text
                  style={{ fontSize: 16, color: "#374151", marginBottom: 6 }}
                >
                  Mood
                </Text>
                <View style={{ flexDirection: "row" }}>
                  {MOODS.map((m) => (
                    <TouchableOpacity 
                      key={m} 
                      onPress={() => setMood(m)} 
                      style={{ 
                        backgroundColor: mood === m ? "#A78BFA" : "#F3F4F6",
                        borderRadius: 8, 
                        paddingVertical: 8, 
                        paddingHorizontal: 14, 
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: mood === m ? "#fff" : "#374151",
                          fontWeight: "600",
                        }}
                      >
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              {/* Log Sleep Button */}
              <TouchableOpacity
                style={{ 
                  backgroundColor:
                    !startTime || !endTime ? "#CBD5E1" : "#3B82F6",
                  borderRadius: 14, 
                  paddingVertical: 16, 
                  alignItems: "center",
                  marginBottom: 8,
                }}
                onPress={handleAddSleep}
                disabled={!startTime || !endTime}
              >
                <Text
                  style={{ color: "#fff", fontWeight: "bold", fontSize: 18 }}
                >
                  {editMode ? "Update Sleep" : "Log Sleep"}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => { 
                  setShowLogModal(false); 
                  setEditMode(false); 
                  setEditingLogId(null); 
                }} 
                style={{ alignItems: "center", marginTop: 2 }}
              >
                <Text style={{ color: "#888", fontSize: 16 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Reminder Time Pickers */}
        {showBedtimeReminderPicker && (
          <DateTimePicker
            value={
              bedtimeReminder
                ? new Date(`1970-01-01T${bedtimeReminder}:00`)
                : new Date()
            }
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, date) => {
              setShowBedtimeReminderPicker(false);
              if (date) {
                const h = date.getHours().toString().padStart(2, "0");
                const m = date.getMinutes().toString().padStart(2, "0");
                setBedtimeReminder(`${h}:${m}`);
              }
            }}
          />
        )}
        {showWakeReminderPicker && (
          <DateTimePicker
            value={
              wakeReminder
                ? new Date(`1970-01-01T${wakeReminder}:00`)
                : new Date()
            }
            mode="time"
            is24Hour={false}
            display="default"
            onChange={(event, date) => {
              setShowWakeReminderPicker(false);
              if (date) {
                const h = date.getHours().toString().padStart(2, "0");
                const m = date.getMinutes().toString().padStart(2, "0");
                setWakeReminder(`${h}:${m}`);
              }
            }}
          />
        )}

        {/* Sleep Goal Modal */}
        <Modal visible={showSleepGoalModal} animationType="fade" transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.2)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 16,
                padding: 20,
                width: "80%",
                maxWidth: 300,
              }}
            >
              <Text
                style={{ 
                  fontWeight: "bold", 
                  fontSize: 18, 
                  marginBottom: 16,
                  textAlign: "center"
                }}
              >
                Set Sleep Goal
              </Text>
              
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 16,
                  textAlign: "center",
                  marginBottom: 20,
                }}
                value={tempSleepGoal.toString()}
                onChangeText={(text) => setTempSleepGoal(parseFloat(text) || 0)}
                keyboardType="numeric"
                placeholder="8"
                maxLength={4}
              />
              
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={{ 
                    flex: 1,
                    backgroundColor: "#F3F4F6",
                    borderRadius: 8, 
                    paddingVertical: 12, 
                    alignItems: "center",
                  }}
                  onPress={() => setShowSleepGoalModal(false)}
                >
                  <Text style={{ color: "#374151", fontWeight: "600" }}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={{ 
                    flex: 1,
                    backgroundColor: "#4F46E5",
                    borderRadius: 8, 
                    paddingVertical: 12, 
                    alignItems: "center",
                  }}
                  onPress={handleSleepGoalUpdate}
                >
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Set Goal</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    fontFamily: "Lexend-Bold",
    color: "#222",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  lastSleepRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  labelBlack: {
    fontSize: 16,
    fontFamily: "Lexend-Bold",
    color: "#222",
    marginBottom: 2,
  },
  labelSmallBlack: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#222",
    marginRight: 8,
  },
  lastSleepDuration: { fontSize: 22, fontFamily: "Lexend-Bold", color: "#222" },
  lastSleepTime: { fontSize: 15, fontFamily: "Manrope-Regular", color: "#222" },
  lastSleepMood: { fontSize: 15, fontFamily: "Manrope-Regular", color: "#222" },
  sleepImg: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginLeft: 12,
    backgroundColor: "#eee",
  },
  sleepImg1: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginLeft: 12,
    backgroundColor: "#eee",
    marginTop: -220,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#222",
    backgroundColor: "#fff",
  },
  pillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    marginRight: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 2,
    elevation: 2,
  },
  pillBtnActive: {
    backgroundColor: "#7B61FF",
    borderColor: "#7B61FF",
  },
  pillBtnInactive: {
    backgroundColor: "#fff",
    borderColor: "#E5E7EB",
  },
  pillBtnText: {
    fontFamily: "Lexend-Bold",
    color: "#222",
    fontSize: 15,
  },
  pillBtnTextActive: {
    color: "#fff",
  },
  addBtn: {
    backgroundColor: "#7B61FF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 18,
  },
  addBtnText: { color: "#fff", fontFamily: "Lexend-Bold", fontSize: 17 },
  syncCard: {
    backgroundColor: "#F3F0FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  syncTitleBlack: {
    fontFamily: "Lexend-Bold",
    fontSize: 16,
    color: "#222",
    marginBottom: 4,
  },
  syncTextBlack: { fontFamily: "Manrope-Regular", fontSize: 15, color: "#222" },
  weekHeadingBlack: {
    fontSize: 20,
    fontFamily: "Lexend-Bold",
    color: "#222",
    marginTop: 18,
    marginBottom: 6,
  },
  barChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  barCol: { alignItems: "center", flex: 1 },
  bar: {
    width: 18,
    backgroundColor: "#D1C4E9",
    borderRadius: 6,
    marginBottom: 4,
  },
  barLabelBlack: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#222" },
  tipsTextBlack: {
    fontFamily: "Manrope-Regular",
    fontSize: 15,
    color: "#222",
    marginBottom: 24,
  },
  timeRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  timeBtn: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 8,
    minWidth: 70,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  timeBtnText: { fontSize: 16, fontFamily: "Lexend-Bold", color: "#222" },
  timeDash: {
    fontSize: 18,
    fontFamily: "Lexend-Bold",
    color: "#222",
    marginHorizontal: 8,
  },
  // Header styles matching ProfileScreen
  container: {
    flex: 1,
    backgroundColor: '#F8F7FC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: getResponsivePadding(8),
    paddingHorizontal: getResponsivePadding(20),
    paddingBottom: getResponsivePadding(8),
    backgroundColor: '#F8F7FC',
    minHeight: getResponsivePadding(40),
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
});

export default SleepTrackerScreen;
