import React, { useCallback } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { TravelComment } from '@/types/comments'

import { CommentItem } from './CommentItem'

type CommentThreadProps = {
  comment: TravelComment
  replies: Record<number, TravelComment[]>
  expandedThreads: Set<number>
  getParentChain: (commentId: number) => TravelComment[]
  onReply?: (comment: TravelComment) => void
  onEdit?: (comment: TravelComment) => void
  onToggleThread: (commentId: number) => void
  colors: {
    primary: string
  }
  styles: Record<string, any>
}

export function CommentThread({
  comment,
  replies,
  expandedThreads,
  getParentChain,
  onReply,
  onEdit,
  onToggleThread,
  colors,
  styles,
}: CommentThreadProps) {
  const renderCommentWithParents = useCallback(
    (threadComment: TravelComment) => {
      const parentChain = getParentChain(threadComment.id)
      if (parentChain.length === 0) return null

      return (
        <View style={styles.parentChainContainer}>
          <View style={styles.parentChainHeader}>
            <Feather
              name="corner-down-right"
              size={16}
              color={DESIGN_TOKENS.colors.textMuted}
            />
            <Text style={styles.parentChainLabel}>
              Ответ в треде (показаны {parentChain.length + 1} из{' '}
              {parentChain.length + 1 + (replies[threadComment.id]?.length || 0)} сообщений)
            </Text>
          </View>
          {parentChain.map((parentComment, index) => (
            <CommentItem
              key={parentComment.id}
              comment={parentComment}
              onReply={onReply}
              onEdit={onEdit}
              level={index}
            />
          ))}
        </View>
      )
    },
    [getParentChain, onEdit, onReply, replies, styles],
  )

  const threadReplies = replies[comment.id] ?? []
  const hasReplies = threadReplies.length > 0
  const isExpanded = expandedThreads.has(comment.id)

  return (
    <View style={styles.commentThread}>
      <CommentItem comment={comment} onReply={onReply} onEdit={onEdit} level={0} />
      {hasReplies && (
        <>
          <Pressable
            onPress={() => onToggleThread(comment.id)}
            style={styles.toggleThreadButton}
            accessibilityLabel={isExpanded ? 'Свернуть ответы' : 'Показать ответы'}
          >
            <View style={styles.threadLine} />
            <Feather
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.toggleThreadText}>
              {isExpanded
                ? `Свернуть ответы (${threadReplies.length})`
                : `Показать ответы (${threadReplies.length})`}
            </Text>
          </Pressable>
          {isExpanded && (
            <View style={styles.repliesContainer}>
              {threadReplies.map((reply) => {
                const parentChain = getParentChain(reply.id)
                const hasParentChain = parentChain.length > 1

                return (
                  <View key={reply.id}>
                    {hasParentChain && renderCommentWithParents(reply)}
                    <CommentItem
                      comment={reply}
                      onReply={onReply}
                      onEdit={onEdit}
                      level={hasParentChain ? parentChain.length : 1}
                    />
                    {replies[reply.id]?.length > 0 && (
                      <View style={styles.nestedRepliesContainer}>
                        {replies[reply.id].map((nestedReply) => (
                          <CommentItem
                            key={nestedReply.id}
                            comment={nestedReply}
                            onReply={onReply}
                            onEdit={onEdit}
                            level={2}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )
              })}
            </View>
          )}
        </>
      )}
    </View>
  )
}
