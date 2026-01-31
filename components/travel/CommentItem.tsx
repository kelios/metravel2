import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';

const Lucide = Platform.OS === 'web' ? require('lucide-react') : require('lucide-react-native');
const Heart = (Lucide as any).Heart as any;
const MessageCircle = (Lucide as any).MessageCircle as any;
const Edit2 = (Lucide as any).Edit2 as any;
const Trash2 = (Lucide as any).Trash2 as any;
const MoreVertical = (Lucide as any).MoreVertical as any;
import type { TravelComment } from '../../types/comments';
import { useAuth } from '../../context/AuthContext';
import { useLikeComment, useUnlikeComment, useDeleteComment } from '../../hooks/useComments';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CommentItemProps {
  comment: TravelComment;
  onReply?: (comment: TravelComment) => void;
  onEdit?: (comment: TravelComment) => void;
  level?: number;
}

export function CommentItem({ comment, onReply, onEdit, level = 0 }: CommentItemProps) {
  const { userId, isSuperuser, isAuthenticated } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const isAuthor = userId && Number(userId) === comment.user;
  const canDelete = isAuthor || isSuperuser;
  const canEdit = isAuthor;
  const isLiked = comment.is_liked;

  const handleLikeToggle = () => {
    if (isLiked) {
      unlikeComment.mutate(comment.id);
    } else {
      likeComment.mutate(comment.id);
    }
  };

  const handleDelete = () => {
    if (confirm('Вы уверены, что хотите удалить комментарий?')) {
      deleteComment.mutate(comment.id);
    }
  };

  const formattedDate = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ru })
    : '';

  return (
    <View style={[styles.container, level > 0 && styles.nested]} testID="comment-item">
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {comment.user_name?.[0]?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View>
            <Text style={styles.userName}>{comment.user_name || 'Пользователь'}</Text>
            <Text style={styles.date}>{formattedDate}</Text>
          </View>
        </View>
        {(canEdit || canDelete) && (
          <Pressable
            onPress={() => setShowActions(!showActions)}
            style={styles.moreButton}
            accessibilityLabel="Действия с комментарием"
          >
            <MoreVertical size={20} color="#666" />
          </Pressable>
        )}
      </View>

      <Text style={styles.text}>{comment.text}</Text>

      {showActions && (canEdit || canDelete) && (
        <View style={styles.actions}>
          {canEdit && onEdit && (
            <Pressable
              onPress={() => {
                onEdit(comment);
                setShowActions(false);
              }}
              style={styles.actionButton}
              accessibilityLabel="Редактировать комментарий"
            >
              <Edit2 size={16} color="#007AFF" />
              <Text style={styles.actionText}>Редактировать</Text>
            </Pressable>
          )}
          {canDelete && (
            <Pressable
              onPress={handleDelete}
              style={styles.actionButton}
              disabled={deleteComment.isPending}
              accessibilityLabel="Удалить комментарий"
            >
              {deleteComment.isPending ? (
                <ActivityIndicator size="small" color="#FF3B30" />
              ) : (
                <>
                  <Trash2 size={16} color="#FF3B30" />
                  <Text style={[styles.actionText, styles.deleteText]}>
                    {isSuperuser && !isAuthor ? 'Удалить (Админ)' : 'Удалить'}
                  </Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.footer}>
        {isAuthenticated && (
          <Pressable
            onPress={handleLikeToggle}
            style={styles.footerButton}
            disabled={likeComment.isPending || unlikeComment.isPending}
            accessibilityLabel={isLiked ? 'Убрать лайк' : 'Поставить лайк'}
          >
            <Heart
              size={18}
              color={isLiked ? '#FF3B30' : '#666'}
              fill={isLiked ? '#FF3B30' : 'none'}
            />
            {comment.likes_count > 0 && (
              <Text style={[styles.footerText, isLiked && styles.likedText]}>
                {comment.likes_count}
              </Text>
            )}
          </Pressable>
        )}

        {!isAuthenticated && comment.likes_count > 0 && (
          <View style={styles.footerButton}>
            <Heart size={18} color="#666" fill="none" />
            <Text style={styles.footerText}>{comment.likes_count}</Text>
          </View>
        )}

        {isAuthenticated && onReply && level < 2 && (
          <Pressable
            onPress={() => onReply(comment)}
            style={styles.footerButton}
            accessibilityLabel="Ответить на комментарий"
          >
            <MessageCircle size={18} color="#666" />
            <Text style={styles.footerText}>Ответить</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  nested: {
    marginLeft: 24,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  date: {
    fontSize: 13,
    color: '#666',
  },
  moreButton: {
    padding: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#000',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
  },
  actionText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  deleteText: {
    color: '#FF3B30',
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  likedText: {
    color: '#FF3B30',
    fontWeight: '600',
  },
});
