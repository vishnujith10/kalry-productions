/**
 * DAILY CHECK-IN MODAL COMPONENT
 * Provides a user-friendly interface for daily check-in questions
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const DailyCheckInModal = ({ 
  visible, 
  onClose, 
  onComplete, 
  userProfile 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState({});

  const questions = [
    {
      id: 'sleep',
      question: 'How many hours did you sleep last night?',
      type: 'number',
      range: [0, 12],
      default: 7,
      icon: '😴'
    },
    {
      id: 'energy',
      question: 'What\'s your energy level today?',
      type: 'select',
      options: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
      icon: '⚡'
    },
    {
      id: 'stress',
      question: 'How stressed do you feel?',
      type: 'select',
      options: ['Very Low', 'Low', 'Medium', 'High', 'Very High'],
      icon: '🧘‍♀️'
    },
    {
      id: 'mood',
      question: 'How\'s your mood today?',
      type: 'scale',
      range: [1, 10],
      labels: { 1: '😔 Low', 5: '😐 Neutral', 10: '😊 Great' },
      icon: '😊'
    },
    {
      id: 'situation',
      question: 'Anything special happening today?',
      type: 'multi-select',
      options: [
        'Normal day',
        'Feeling sick',
        'Traveling',
        'High stress/busy',
        'Period/PMS',
        'Special event/celebration',
        'Extra active day',
        'Working late'
      ],
      icon: '📅'
    }
  ];

  const currentQuestion = questions[currentQuestionIndex];

  const handleResponse = (value) => {
    setResponses(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    // Pass the raw responses to the completion callback
    // Let the parent component handle the processing
    onComplete(responses);
    
    // Reset for next time
    setCurrentQuestionIndex(0);
    setResponses({});
    onClose();
  };

  const renderQuestion = () => {
    const currentResponse = responses[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'number':
        return (
          <View style={styles.numberInput}>
            <Text style={styles.numberValue}>
              {currentResponse || currentQuestion.default}
            </Text>
            <View style={styles.numberControls}>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => handleResponse(Math.max(0, (currentResponse || currentQuestion.default) - 0.5))}
              >
                <Ionicons name="remove" size={20} color="#7B61FF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => handleResponse(Math.min(12, (currentResponse || currentQuestion.default) + 0.5))}
              >
                <Ionicons name="add" size={20} color="#7B61FF" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'select':
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  currentResponse === option && styles.selectedOption
                ]}
                onPress={() => handleResponse(option)}
              >
                <Text style={[
                  styles.optionText,
                  currentResponse === option && styles.selectedOptionText
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'scale':
        return (
          <View style={styles.scaleContainer}>
            <Text style={styles.scaleLabel}>
              {currentQuestion.labels[1]} ← → {currentQuestion.labels[10]}
            </Text>
            <View style={styles.scaleButtons}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(value => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.scaleButton,
                    currentResponse === value && styles.selectedScaleButton
                  ]}
                  onPress={() => handleResponse(value)}
                >
                  <Text style={[
                    styles.scaleButtonText,
                    currentResponse === value && styles.selectedScaleButtonText
                  ]}>
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'multi-select':
        const selectedOptions = currentResponse || [];
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  selectedOptions.includes(option) && styles.selectedOption
                ]}
                onPress={() => {
                  const newSelection = selectedOptions.includes(option)
                    ? selectedOptions.filter(opt => opt !== option)
                    : [...selectedOptions, option];
                  handleResponse(newSelection);
                }}
              >
                <Text style={[
                  styles.optionText,
                  selectedOptions.includes(option) && styles.selectedOptionText
                ]}>
                  {option}
                </Text>
                {selectedOptions.includes(option) && (
                  <Ionicons name="checkmark" size={16} color="#7B61FF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    const currentResponse = responses[currentQuestion.id];
    if (currentQuestion.type === 'multi-select') {
      return Array.isArray(currentResponse) && currentResponse.length > 0;
    }
    return currentResponse !== undefined && currentResponse !== null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>Daily Check-in</Text>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentQuestionIndex + 1} of {questions.length}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.questionContainer}>
            <Text style={styles.questionIcon}>{currentQuestion.icon}</Text>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            {renderQuestion()}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {currentQuestionIndex > 0 && (
            <TouchableOpacity
              style={styles.previousButton}
              onPress={handlePrevious}
            >
              <Ionicons name="chevron-back" size={20} color="#7B61FF" />
              <Text style={styles.previousButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.nextButtonDisabled
            ]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={[
              styles.nextButtonText,
              !canProceed() && styles.nextButtonTextDisabled
            ]}>
              {currentQuestionIndex === questions.length - 1 ? 'Complete' : 'Next'}
            </Text>
            {currentQuestionIndex < questions.length - 1 && (
              <Ionicons name="chevron-forward" size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7B61FF',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  questionIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 28,
  },
  numberInput: {
    alignItems: 'center',
  },
  numberValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#7B61FF',
    marginBottom: 16,
  },
  numberControls: {
    flexDirection: 'row',
    gap: 16,
  },
  numberButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#7B61FF',
  },
  optionsContainer: {
    width: '100%',
    gap: 12,
  },
  optionButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F8F9FF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedOption: {
    backgroundColor: '#F0F9FF',
    borderColor: '#7B61FF',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#7B61FF',
    fontWeight: '600',
  },
  scaleContainer: {
    width: '100%',
    alignItems: 'center',
  },
  scaleLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  scaleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  scaleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FF',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedScaleButton: {
    backgroundColor: '#7B61FF',
    borderColor: '#7B61FF',
  },
  scaleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  selectedScaleButtonText: {
    color: 'white',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  previousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  previousButtonText: {
    fontSize: 16,
    color: '#7B61FF',
    fontWeight: '600',
    marginLeft: 4,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7B61FF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 16,
  },
  nextButtonDisabled: {
    backgroundColor: '#E2E8F0',
  },
  nextButtonText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
    marginRight: 4,
  },
  nextButtonTextDisabled: {
    color: '#999',
  },
});
