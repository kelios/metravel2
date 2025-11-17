// Улучшенный компонент чата с историей, форматированием и лучшим UX
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { sendAIMessage } from '@/src/api/travels';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAT_HISTORY_KEY = 'chat_history';
const MAX_HISTORY_LENGTH = 50;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  status?: 'sending' | 'sent' | 'error';
}

const QUICK_QUESTIONS = [
  'Где лучше отдохнуть в Беларуси?',
  'Какие достопримечательности посетить?',
  'Помоги спланировать маршрут',
  'Расскажи о скрытых местах',
];

export default function ImprovedChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Загрузка истории при монтировании
  useEffect(() => {
    loadHistory();
  }, []);

  // Сохранение истории при изменении
  useEffect(() => {
    if (messages.length > 0) {
      saveHistory();
    }
  }, [messages]);

  // Прокрутка вниз при новых сообщениях
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, isTyping]);

  const loadHistory = async () => {
    try {
      const history = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
      if (history) {
        setMessages(JSON.parse(history));
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveHistory = async () => {
    try {
      const toSave = messages.slice(-MAX_HISTORY_LENGTH);
      await AsyncStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }
  };

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text || inputText).trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      text: messageText,
      isUser: true,
      timestamp: Date.now(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    setIsLoading(true);

    try {
      const response = await sendAIMessage(messageText);
      
      // Обновляем статус пользовательского сообщения
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: 'sent' } : msg
        )
      );

      // Добавляем ответ бота
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        text: response.data?.reply || response.reply || 'Извините, не удалось получить ответ.',
        isUser: false,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Ошибка при отправке запроса:', error);
      
      // Обновляем статус на ошибку
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === userMessage.id ? { ...msg, status: 'error' } : msg
        )
      );

      // Добавляем сообщение об ошибке
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Произошла ошибка. Попробуйте еще раз.',
        isUser: false,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsLoading(false);
    }
  }, [inputText]);

  const clearHistory = async () => {
    setMessages([]);
    try {
      await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const retryMessage = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message && message.isUser) {
      sendMessage(message.text);
    }
  }, [messages, sendMessage]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isUser = item.isUser;
    
    return (
      <View
        style={[
          styles.messageWrapper,
          isUser ? styles.userWrapper : styles.botWrapper,
        ]}
      >
        <View
          style={[
            styles.messageContainer,
            isUser ? styles.userMessage : styles.botMessage,
          ]}
        >
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
            {isUser && item.status === 'error' && (
              <Pressable
                onPress={() => retryMessage(item.id)}
                style={styles.retryButton}
                hitSlop={8}
              >
                <Feather name="refresh-cw" size={14} color="#ef5350" />
              </Pressable>
            )}
            {isUser && item.status === 'sending' && (
              <ActivityIndicator size="small" color="#999" style={{ marginLeft: 4 }} />
            )}
          </View>
        </View>
      </View>
    );
  }, [retryMessage]);

  const renderQuickQuestion = useCallback(({ item }: { item: string }) => (
    <Pressable
      style={styles.quickQuestion}
      onPress={() => sendMessage(item)}
      disabled={isLoading}
    >
      <Text style={styles.quickQuestionText}>{item}</Text>
    </Pressable>
  ), [sendMessage, isLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AI Помощник</Text>
          {messages.length > 0 && (
            <Pressable onPress={clearHistory} style={styles.clearButton} hitSlop={8}>
              <Feather name="trash-2" size={18} color="#666" />
            </Pressable>
          )}
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>Начните диалог</Text>
              <Text style={styles.emptyDescription}>
                Задайте вопрос о путешествиях, и я помогу вам найти интересные места
              </Text>
              <FlatList
                data={QUICK_QUESTIONS}
                renderItem={renderQuickQuestion}
                keyExtractor={(item, index) => `question-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickQuestionsContainer}
              />
            </View>
          }
          ListFooterComponent={
            isTyping ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color="#6b8e7f" />
                <Text style={styles.typingText}>Печатает...</Text>
              </View>
            ) : null
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Задайте ваш вопрос..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
            editable={!isLoading}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => sendMessage()}
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            disabled={!inputText.trim() || isLoading}
            hitSlop={8}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={20} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1b1f23',
  },
  clearButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  botWrapper: {
    justifyContent: 'flex-start',
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  userMessage: {
    backgroundColor: '#6b8e7f',
    borderBottomRightRadius: 4,
  },
  botMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#1b1f23',
  },
  userMessageText: {
    color: '#fff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  retryButton: {
    marginLeft: 8,
    padding: 4,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  typingText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1b1f23',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  quickQuestionsContainer: {
    paddingHorizontal: 8,
    gap: 8,
  },
  quickQuestion: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#6b8e7f',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 15,
    color: '#1b1f23',
    ...Platform.select({
      web: {
        outlineWidth: 0,
      },
    }),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6b8e7f',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
});

