import axios from 'axios';
const API_BASE_URL = 'https://wdkraevjbcguvwpxscqf.supabase.co/functions/v1';

export async function getDailyGoal(userId) {
  const res = await fetch(`${API_BASE_URL}/step-goals/${userId}`);
  const data = await res.json();
  return data.goal || 10000;
}

export async function setDailyGoal(userId, goal) {
  try {
    const response = await axios.post(`${API_BASE_URL}/step-goals`, {
      user_id: userId,
      goal,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      console.log('setDailyGoal error:', error.response.data);
    } else {
      console.log('setDailyGoal error:', error.message);
    }
    throw error;
  }
}