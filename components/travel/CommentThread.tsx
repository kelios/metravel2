import React, { useCallback } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'

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
    primaryDark: string
    textMuted: string
  }
  styles: Record<string, any>
}

function CommentThreadComponent({
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
              color={colors.textMuted}
            />
            <Text style={styles.parentChainLabel}>
              Контекст ветки обсуждения
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
    [colors.textMuted, getParentChain, onEdit, onReply, styles],
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
              color={colors.primaryDark}
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

export const CommentThread = React.memo(CommentThreadComponent)
