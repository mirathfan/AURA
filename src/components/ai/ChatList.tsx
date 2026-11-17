import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, Text, View, type ViewToken } from "react-native";

import { Fonts, type AppColors } from "@/constants/theme";
import { AuraSkeletonLine } from "@/src/components/ui/AuraSkeleton";
import { captureSafeException } from "@/src/lib/sentry";
import type { ClothingItem } from "@/src/types/ClothingItem";
import type { AuraCandidateAction, AuraLaundryConfirmationAction, AuraLookAction, AuraLookOptionMeta, AuraOutfitPhotoAction } from "@/src/types/aura";
import type { AuraAgentOutfit, AuraAgentSuggestedAction } from "@/src/types/auraAgent";

import ChatMessage from "./ChatMessage";
import type { AIMessage, ChatMessageActionAnchor } from "./chatTypes";
import {
  decideAuraReplyReveal,
  getAuraChatBottomPadding,
  isAuraOutfitReply,
  shouldShowAuraTypingBubble,
} from "./chatListLayout";

const FOLLOW_DISTANCE_THRESHOLD = 96;
const FOCUS_MESSAGE_VIEW_POSITION = 0;
const FOCUS_MESSAGE_VIEW_OFFSET = 8;
const FOCUS_ANCHOR_SPACER_RATIO = 1.12;
const FOCUS_ANCHOR_MIN_SPACER = 560;
const FOCUS_ANCHOR_LOCK_MS = 680;

const ChatItemSeparator = React.memo(function ChatItemSeparator() {
  return <View style={{ height: 16 }} />;
});

class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; colors: AppColors; resetKey: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    captureSafeException(error, { boundary: "aura_chat_message" });
  }

  componentDidUpdate(prevProps: { resetKey: string }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const { colors } = this.props;
    return (
      <View style={{ alignItems: "flex-start", paddingHorizontal: 8 }}>
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceGlass,
            paddingHorizontal: 14,
            paddingVertical: 11,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
            {"Couldn't render this message."}
          </Text>
        </View>
      </View>
    );
  }
}

function TypingBubble({ colors, label }: { colors: AppColors; label?: string | null }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 560, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 560, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ alignItems: "flex-start", paddingHorizontal: 10 }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={label ?? "AURA is working"}
        style={{
          borderRadius: 20,
          paddingHorizontal: 14,
          paddingVertical: 11,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 0.75,
          borderColor: colors.borderSoft,
          gap: 9,
          minWidth: 178,
          maxWidth: "86%",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {[0, 1, 2].map((index) => (
            <Animated.View
              key={index}
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                backgroundColor: colors.textSecondary,
                opacity: pulse.interpolate({
                  inputRange: [0.45, 1],
                  outputRange: [0.3 + index * 0.12, 0.82 - index * 0.1],
                }),
              }}
            />
          ))}
        </View>
        {label ? (
          <Text
            numberOfLines={2}
            style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, fontFamily: Fonts.sans }}
          >
            {label}
          </Text>
        ) : (
          <AuraSkeletonLine width="72%" height={8} />
        )}
      </View>
    </View>
  );
}

export default function ChatList({
  colors,
  messages,
  itemsById,
  savingId,
  loading,
  loadingLabel,
  memoryHint,
  contentBottomPadding,
  floatingBottomOffset,
  autoScrollSignal = 0,
  focusMessageId,
  emptyState,
  refreshing = false,
  onRefresh,
  onSaveOutfit,
  onMoreLikeThis,
  onSwapOutfit,
  onAuraAction,
  onAuraCandidateAction,
  onAuraOutfitPhotoAction,
  onAuraLaundryAction,
  onAuraAgentAction,
  onAuraAgentOutfitSelect,
  onRetryAuraResponse,
  onMessageLongPress,
  selectedAgentOutfitId,
  auraAgentLoadingActionId,
  auraAgentLoadingMessageId,
}: {
  colors: AppColors;
  messages: AIMessage[];
  itemsById: Map<string, ClothingItem>;
  savingId: string | null;
  loading: boolean;
  // What the app is really doing right now, shown in the pending bubble.
  loadingLabel?: string | null;
  memoryHint?: string | null;
  contentBottomPadding: number;
  // Height of whatever covers the bottom of the list (composer, tab bar), so
  // floating controls can sit just above it. Defaults to the content padding.
  floatingBottomOffset?: number;
  autoScrollSignal?: number;
  focusMessageId?: string | null;
  emptyState?: React.ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
  onSaveOutfit: (outfitId: string) => void;
  onMoreLikeThis: (outfit: import("./chatTypes").ChatOutfit) => void;
  onSwapOutfit: (outfit: import("./chatTypes").ChatOutfit) => void;
  onAuraAction?: (
    action: AuraLookAction,
    message: AIMessage,
    look?: import("@/src/types/aura").AuraLook,
    lookOption?: AuraLookOptionMeta,
  ) => void;
  onAuraCandidateAction?: (action: AuraCandidateAction, message: AIMessage) => void;
  onAuraOutfitPhotoAction?: (action: AuraOutfitPhotoAction, message: AIMessage) => void;
  onAuraLaundryAction?: (action: AuraLaundryConfirmationAction, message: AIMessage) => void;
  onAuraAgentAction?: (action: AuraAgentSuggestedAction, message: AIMessage, outfit?: AuraAgentOutfit | null) => void;
  onAuraAgentOutfitSelect?: (outfit: AuraAgentOutfit, message: AIMessage) => void;
  onRetryAuraResponse?: (message: AIMessage) => void;
  onMessageLongPress?: (message: AIMessage, anchor: ChatMessageActionAnchor) => void;
  selectedAgentOutfitId?: string | null;
  auraAgentLoadingActionId?: string | null;
  auraAgentLoadingMessageId?: string | null;
}) {
  const listRef = useRef<FlatList<AIMessage>>(null);
  const previousCountRef = useRef(messages.length);
  const hasStreamingMessage = useMemo(() => messages.some((message) => message.streaming), [messages]);
  const shouldFollowRef = useRef(true);
  const focusAnchorActiveRef = useRef(false);
  const userInteractingRef = useRef(false);
  const streamingScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToIndexRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusAnchorReleaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoScrollKeyRef = useRef<string | null>(null);
  const lastInsetScrollKeyRef = useRef<string | null>(null);
  const dismissedFocusMessageIdRef = useRef<string | null>(null);
  const loadingRef = useRef(loading);
  const previousLoadingRef = useRef(loading);
  const messagesRef = useRef(messages);
  // Reply reveal: did the user scroll since their last message, can they
  // still see it, and are they at the bottom.
  const userScrolledThisTurnRef = useRef(false);
  const nearBottomRef = useRef(true);
  const viewableIdsRef = useRef<Set<string>>(new Set());
  const unseenReplyIdRef = useRef<string | null>(null);
  // The outfit reply this turn's reveal has taken charge of. While it is the
  // last message, the generic "follow the bottom" effects must stand down.
  const revealedReplyIdRef = useRef<string | null>(null);
  const [unseenReplyId, setUnseenReplyId] = React.useState<string | null>(null);
  const [listViewportHeight, setListViewportHeight] = React.useState(0);
  const [activeFocusAnchorId, setActiveFocusAnchorId] = React.useState<string | null>(null);
  const messageCount = messages.length;
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = lastMessage?.id ?? null;
  const effectiveContentBottomPadding = useMemo(
    () => getAuraChatBottomPadding(contentBottomPadding),
    [contentBottomPadding],
  );
  const showTypingBubble = shouldShowAuraTypingBubble({
    loading,
    hasStreamingMessage,
    lastMessage,
  });
  const focusedMessageIndex = useMemo(
    () => (focusMessageId ? messages.findIndex((message) => message.id === focusMessageId) : -1),
    [focusMessageId, messages],
  );
  const hasFocusedMessage = !!focusMessageId && focusedMessageIndex >= 0;
  const isFocusAnchoring =
    hasFocusedMessage &&
    loading &&
    dismissedFocusMessageIdRef.current !== focusMessageId;
  const focusAnchorSpacer = isFocusAnchoring
    ? Math.max(effectiveContentBottomPadding, listViewportHeight * FOCUS_ANCHOR_SPACER_RATIO, FOCUS_ANCHOR_MIN_SPACER)
    : 0;

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const scrollToBottomIfFollowing = useCallback(
    (animated: boolean) => {
      if (!shouldFollowRef.current) return;
      scrollToBottom(animated);
    },
    [scrollToBottom],
  );

  const scrollToFocusedMessage = useCallback((messageId: string | null | undefined, animated: boolean) => {
    if (!messageId) return;
    requestAnimationFrame(() => {
      const currentMessages = messagesRef.current;
      const index = currentMessages.findIndex((message) => message.id === messageId);
      if (index < 0 || index >= currentMessages.length) return;
      listRef.current?.scrollToIndex({
        index,
        animated,
        viewPosition: FOCUS_MESSAGE_VIEW_POSITION,
        viewOffset: FOCUS_MESSAGE_VIEW_OFFSET,
      });
    });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nearBottom = distanceFromBottom < FOLLOW_DISTANCE_THRESHOLD;
    nearBottomRef.current = nearBottom;
    if (userInteractingRef.current || nearBottom) {
      shouldFollowRef.current = nearBottom;
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    userInteractingRef.current = true;
    userScrolledThisTurnRef.current = true;
    focusAnchorActiveRef.current = false;
    dismissedFocusMessageIdRef.current = focusMessageId ?? activeFocusAnchorId;
    if (focusAnchorReleaseTimerRef.current) {
      clearTimeout(focusAnchorReleaseTimerRef.current);
      focusAnchorReleaseTimerRef.current = null;
    }
    setActiveFocusAnchorId(null);
  }, [activeFocusAnchorId, focusMessageId]);

  const handleScrollEndDrag = useCallback(() => {
    userInteractingRef.current = false;
  }, []);

  const handleMomentumScrollBegin = useCallback(() => {
    userInteractingRef.current = true;
    focusAnchorActiveRef.current = false;
    dismissedFocusMessageIdRef.current = focusMessageId ?? activeFocusAnchorId;
    if (focusAnchorReleaseTimerRef.current) {
      clearTimeout(focusAnchorReleaseTimerRef.current);
      focusAnchorReleaseTimerRef.current = null;
    }
    setActiveFocusAnchorId(null);
  }, [activeFocusAnchorId, focusMessageId]);

  const handleMomentumScrollEnd = useCallback(() => {
    userInteractingRef.current = false;
  }, []);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (streamingScrollTimerRef.current) {
        clearTimeout(streamingScrollTimerRef.current);
      }
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
      }
      if (scrollToIndexRetryRef.current) {
        clearTimeout(scrollToIndexRetryRef.current);
      }
      if (focusAnchorReleaseTimerRef.current) {
        clearTimeout(focusAnchorReleaseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const shouldAnimate = messageCount >= previousCountRef.current;
    previousCountRef.current = messageCount;
    if (isFocusAnchoring) {
      const timer = setTimeout(() => scrollToFocusedMessage(focusMessageId, false), 30);
      return () => clearTimeout(timer);
    }
    if (focusMessageId && focusedMessageIndex >= 0 && lastMessageId === focusMessageId) {
      return;
    }
    const timer = setTimeout(() => {
      scrollToBottomIfFollowing(shouldAnimate && !hasStreamingMessage);
    }, 30);
    return () => clearTimeout(timer);
  }, [
    focusMessageId,
    focusedMessageIndex,
    hasStreamingMessage,
    isFocusAnchoring,
    lastMessageId,
    loading,
    messageCount,
    scrollToBottomIfFollowing,
    scrollToFocusedMessage,
  ]);

  useEffect(() => {
    if (!focusMessageId || focusedMessageIndex < 0) return;
    dismissedFocusMessageIdRef.current = null;
    focusAnchorActiveRef.current = true;
    shouldFollowRef.current = false;
    setActiveFocusAnchorId(focusMessageId);
    if (focusAnchorReleaseTimerRef.current) {
      clearTimeout(focusAnchorReleaseTimerRef.current);
    }
    const focusTimer = setTimeout(() => scrollToFocusedMessage(focusMessageId, true), 50);
    focusAnchorReleaseTimerRef.current = setTimeout(() => {
      if (loadingRef.current) return;
      focusAnchorActiveRef.current = false;
      focusAnchorReleaseTimerRef.current = null;
      if (!userInteractingRef.current) {
        shouldFollowRef.current = true;
        setActiveFocusAnchorId(null);
        scrollToBottom(false);
      }
    }, FOCUS_ANCHOR_LOCK_MS);
    return () => clearTimeout(focusTimer);
  }, [focusMessageId, focusedMessageIndex, scrollToBottom, scrollToFocusedMessage]);

  useEffect(() => {
    if (loading || !activeFocusAnchorId) return;
    focusAnchorActiveRef.current = false;
    if (focusAnchorReleaseTimerRef.current) {
      clearTimeout(focusAnchorReleaseTimerRef.current);
      focusAnchorReleaseTimerRef.current = null;
    }
    setActiveFocusAnchorId(null);
    // An outfit reply is revealed from its top by the effect below; jumping
    // to the bottom would land under the picture.
    const currentMessages = messagesRef.current;
    if (isAuraOutfitReply(currentMessages[currentMessages.length - 1])) return;
    shouldFollowRef.current = true;
    const timer = setTimeout(() => {
      if (!userInteractingRef.current) scrollToBottom(false);
    }, 80);
    return () => clearTimeout(timer);
  }, [activeFocusAnchorId, loading, scrollToBottom]);

  // A new message from the user starts a new turn. The screen also clears
  // focusMessageId once a reply lands; that is not a new turn and must not
  // undo the reveal.
  useEffect(() => {
    if (!focusMessageId) return;
    userScrolledThisTurnRef.current = false;
    revealedReplyIdRef.current = null;
    unseenReplyIdRef.current = null;
    setUnseenReplyId(null);
  }, [focusMessageId]);

  // When an outfit reply lands, bring its top into view, unless the user has
  // scrolled away to read earlier messages. Then leave them where they are
  // and offer a way to jump to it.
  useEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = loading;
    if (!wasLoading || loading) return;
    const currentMessages = messagesRef.current;
    const reply = currentMessages[currentMessages.length - 1];
    if (!isAuraOutfitReply(reply)) return;
    revealedReplyIdRef.current = reply.id;
    shouldFollowRef.current = false;
    const decision = decideAuraReplyReveal({
      userScrolledThisTurn: userScrolledThisTurnRef.current,
      questionVisible: focusMessageId ? viewableIdsRef.current.has(focusMessageId) : true,
      nearBottom: nearBottomRef.current,
    });
    if (decision === "hold") {
      // No need to point at something already on screen.
      if (viewableIdsRef.current.has(reply.id)) return;
      unseenReplyIdRef.current = reply.id;
      setUnseenReplyId(reply.id);
      return;
    }
    // Later size changes (images loading) must not pull the list to the bottom.
    shouldFollowRef.current = false;
    const timer = setTimeout(() => scrollToFocusedMessage(reply.id, true), 120);
    return () => clearTimeout(timer);
  }, [focusMessageId, loading, scrollToFocusedMessage]);

  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    viewableIdsRef.current = new Set(viewableItems.map((entry) => String((entry.item as AIMessage | undefined)?.id ?? "")));
    const unseen = unseenReplyIdRef.current;
    if (unseen && viewableIdsRef.current.has(unseen)) {
      unseenReplyIdRef.current = null;
      setUnseenReplyId(null);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 1 }).current;

  const handleShowUnseenReply = useCallback(() => {
    const replyId = unseenReplyIdRef.current;
    unseenReplyIdRef.current = null;
    setUnseenReplyId(null);
    shouldFollowRef.current = false;
    scrollToFocusedMessage(replyId, true);
  }, [scrollToFocusedMessage]);

  useEffect(() => {
    if (!autoScrollSignal || !messageCount || !lastMessageId || !listViewportHeight) return;
    if (isFocusAnchoring) return;
    if (revealedReplyIdRef.current === lastMessageId) return;
    const autoScrollKey = [
      autoScrollSignal,
      lastMessageId,
      messageCount,
      Math.round(effectiveContentBottomPadding),
      Math.round(listViewportHeight),
    ].join(":");
    if (lastAutoScrollKeyRef.current === autoScrollKey) return;
    lastAutoScrollKeyRef.current = autoScrollKey;
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
    const frame = requestAnimationFrame(() => {
      autoScrollTimerRef.current = setTimeout(() => {
        autoScrollTimerRef.current = null;
        if (userInteractingRef.current) return;
        shouldFollowRef.current = true;
        scrollToBottom(false);
      }, 80);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (autoScrollTimerRef.current) {
        clearTimeout(autoScrollTimerRef.current);
        autoScrollTimerRef.current = null;
      }
    };
  }, [
    autoScrollSignal,
    effectiveContentBottomPadding,
    isFocusAnchoring,
    lastMessageId,
    listViewportHeight,
    messageCount,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!messageCount || !lastMessageId || !listViewportHeight) return;
    if (isFocusAnchoring || userInteractingRef.current || !shouldFollowRef.current) return;
    if (revealedReplyIdRef.current === lastMessageId) return;
    const insetScrollKey = [
      lastMessageId,
      messageCount,
      Math.round(effectiveContentBottomPadding),
      Math.round(listViewportHeight),
    ].join(":");
    if (lastInsetScrollKeyRef.current === insetScrollKey) return;
    lastInsetScrollKeyRef.current = insetScrollKey;
    const timer = setTimeout(() => {
      if (userInteractingRef.current || !shouldFollowRef.current) return;
      scrollToBottom(false);
    }, 90);
    return () => clearTimeout(timer);
  }, [
    effectiveContentBottomPadding,
    isFocusAnchoring,
    lastMessageId,
    listViewportHeight,
    messageCount,
    scrollToBottom,
  ]);

  const contentContainerStyle = useMemo(
    () => ({
      flexGrow: 1,
      justifyContent: messageCount ? ("flex-start" as const) : ("flex-end" as const),
      paddingTop: messageCount ? 14 : 0,
      paddingHorizontal: 6,
      paddingBottom: effectiveContentBottomPadding,
    }),
    [effectiveContentBottomPadding, messageCount],
  );

  const scrollIndicatorInsets = useMemo(
    () => ({ bottom: Math.max(8, effectiveContentBottomPadding - 8) }),
    [effectiveContentBottomPadding],
  );

  const handleContentSizeChange = useCallback(() => {
    if (isFocusAnchoring) {
      return;
    }
    if (shouldFollowRef.current) {
      if (hasStreamingMessage) {
        if (streamingScrollTimerRef.current) return;
        streamingScrollTimerRef.current = setTimeout(() => {
          streamingScrollTimerRef.current = null;
          scrollToBottomIfFollowing(false);
        }, 80);
        return;
      }
      scrollToBottomIfFollowing(false);
    }
  }, [hasStreamingMessage, isFocusAnchoring, scrollToBottomIfFollowing]);

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = Math.ceil(event.nativeEvent.layout.height);
    setListViewportHeight((current) => (Math.abs(current - nextHeight) > 1 ? nextHeight : current));
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: { averageItemLength: number; index: number }) => {
      if (scrollToIndexRetryRef.current) {
        clearTimeout(scrollToIndexRetryRef.current);
      }
      const currentMessages = messagesRef.current;
      if (info.index < 0 || info.index >= currentMessages.length) {
        scrollToIndexRetryRef.current = null;
        scrollToBottomIfFollowing(false);
        return;
      }
      const retryMessageId = currentMessages[info.index]?.id;
      if (!retryMessageId) return;
      const offset = Math.max(0, info.averageItemLength * info.index - FOCUS_MESSAGE_VIEW_OFFSET);
      listRef.current?.scrollToOffset({ offset, animated: true });
      scrollToIndexRetryRef.current = setTimeout(() => {
        scrollToIndexRetryRef.current = null;
        scrollToFocusedMessage(retryMessageId, true);
      }, 120);
    },
    [scrollToBottomIfFollowing, scrollToFocusedMessage],
  );

  const keyExtractor = useCallback((item: AIMessage) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: AIMessage }) => {
      return (
        <ChatErrorBoundary colors={colors} resetKey={`${item.id}:${item.createdAt ?? ""}:${item.streaming ? "streaming" : "done"}`}>
          <ChatMessage
            colors={colors}
            message={item}
            itemsById={itemsById}
            savingId={savingId}
            memoryHint={memoryHint}
            onSaveOutfit={onSaveOutfit}
            onMoreLikeThis={onMoreLikeThis}
            onSwapOutfit={onSwapOutfit}
            onAuraAction={onAuraAction}
            onAuraCandidateAction={onAuraCandidateAction}
            onAuraOutfitPhotoAction={onAuraOutfitPhotoAction}
            onAuraLaundryAction={onAuraLaundryAction}
            onAuraAgentAction={onAuraAgentAction}
            onAuraAgentOutfitSelect={onAuraAgentOutfitSelect}
            onRetryAuraResponse={onRetryAuraResponse}
            onMessageActionPress={onMessageLongPress}
            selectedAgentOutfitId={selectedAgentOutfitId}
            auraAgentActionsDisabled={loading}
            auraAgentLoadingActionId={auraAgentLoadingActionId}
            auraAgentLoadingMessageId={auraAgentLoadingMessageId}
          />
        </ChatErrorBoundary>
      );
    },
    [
      colors,
      itemsById,
      memoryHint,
      onAuraAction,
      onAuraAgentAction,
      onAuraAgentOutfitSelect,
      onAuraCandidateAction,
      onAuraLaundryAction,
      onAuraOutfitPhotoAction,
      onMoreLikeThis,
      onMessageLongPress,
      onRetryAuraResponse,
      onSaveOutfit,
      onSwapOutfit,
      savingId,
      loading,
      selectedAgentOutfitId,
      auraAgentLoadingActionId,
      auraAgentLoadingMessageId,
    ],
  );

  const listFooter = useMemo(
    () => {
      if (!showTypingBubble && !focusAnchorSpacer) return null;
      return (
        <View>
          {showTypingBubble ? (
            <View style={{ marginTop: 12, marginBottom: 10 }}>
              <TypingBubble colors={colors} label={loadingLabel} />
            </View>
          ) : null}
          {focusAnchorSpacer ? <View style={{ height: focusAnchorSpacer }} /> : null}
        </View>
      );
    },
    [colors, focusAnchorSpacer, loadingLabel, showTypingBubble],
  );

  return (
    <View style={{ flex: 1 }}>
    <FlatList
      ref={listRef}
      style={{ flex: 1 }}
      data={messages}
      keyExtractor={keyExtractor}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={16}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleListLayout}
      onScrollToIndexFailed={handleScrollToIndexFailed}
      onViewableItemsChanged={handleViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      contentContainerStyle={contentContainerStyle}
      scrollIndicatorInsets={scrollIndicatorInsets}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.ctaCream}
            colors={[colors.ctaCream]}
            progressBackgroundColor={colors.background}
          />
        ) : undefined
      }
      ListEmptyComponent={emptyState ?? null}
      renderItem={renderItem}
      ItemSeparatorComponent={ChatItemSeparator}
      ListFooterComponent={listFooter}
      removeClippedSubviews={false}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      updateCellsBatchingPeriod={40}
      windowSize={7}
      showsVerticalScrollIndicator={false}
    />
    {unseenReplyId ? (
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(18, floatingBottomOffset ?? contentBottomPadding) + 12, alignItems: "center" }}
      >
        <Pressable
          onPress={handleShowUnseenReply}
          accessibilityRole="button"
          accessibilityLabel="Show the new outfit"
          hitSlop={8}
          style={{
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 0.75,
            borderColor: colors.borderSoft,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", fontFamily: Fonts.sans }}>
            New outfit ↓
          </Text>
        </Pressable>
      </View>
    ) : null}
    </View>
  );
}
