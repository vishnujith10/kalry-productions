import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadCardioSessions } from '../lib/cardioSessionApi';
import supabase from '../lib/supabase';

export default function SavedCardioSessionsScreen() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    async function fetchSessions() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const sessions = await loadCardioSessions(session.user.id);
        setSessions(sessions);
      }
      setLoading(false);
    }
    fetchSessions();
  }, []);

  if (loading) return <ActivityIndicator />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
      {/* Header (SafeArea) */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderColor: '#eee',
        minHeight: 48,
        backgroundColor: '#F9FAFB'
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '600', color: '#333' }}>Saved Workouts</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={{ flex: 1, padding: 16 }}>
        <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: '#E5E7EB'
            }}
            onPress={() => navigation.navigate('CardioPlayerScreen', { session: item })}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 18 }}>{item.name}</Text>
            <Text style={{ color: '#6B7280', marginTop: 4 }}>
              {item.total_rounds} rounds • {Math.round((item.estimated_time || 0) / 60)} min
            </Text>
            <Text style={{ color: '#22C55E', marginTop: 4 }}>Play</Text>
          </TouchableOpacity>
        )}
        />
      </View>
    </SafeAreaView>
  );
} 