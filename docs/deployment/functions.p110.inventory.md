| Function | Change / definition | Entry module | Trigger | Secret mounts | Limits (s / MiB / max / concurrency) |
|---|---|---|---|---|---|
| askAura | UPDATE / modified | `src/askAura.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| askAuraStream | UPDATE / modified | `src/askAuraStream.ts` | https | OPENAI_API_KEY | 120 / default / default / default |
| auditClosetDraftItems | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | — | 120 / default / default / default |
| backfillWardrobeIntelligence | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | OPENAI_API_KEY | 540 / default / default / default |
| backfillWardrobeIntelligenceAll | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | OPENAI_API_KEY | 540 / default / default / default |
| bulkDeleteAbandonedDrafts | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | — | 120 / default / default / default |
| cleanupAbandonedDraftClosetItems | UPDATE / modified | `src/ai/wardrobeIntelligence/scheduledDraftCleanup.ts` | schedule every day 03:15 America/Chicago | — | 540 / 512 / default / default |
| continueAccountDeletion | ADD / added | `src/deleteAccountData.ts` | event created accountDeletionJobs/{uid}; retry=true | — | 540 / 512 / default / default |
| deleteAccountData | UPDATE / modified | `src/deleteAccountData.ts` | callable | — | 540 / 512 / default / default |
| deleteClosetItem | ADD / added | `src/deleteClosetItem.ts` | callable | — | default / default / default / default |
| deleteDraftClosetItem | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | — | 60 / default / default / default |
| deleteStyleMemory | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | — | 60 / default / default / default |
| dislikeAuraAgentOutfit | UPDATE / modified | `src/ai/wardrobeIntelligence/agentActionCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| extractOutfitItems | UPDATE / modified | `src/extractOutfitItems.ts` | callable | OPENAI_API_KEY | 540 / 1024 / default / default |
| extractProductFromUrl | UPDATE / unchanged | `src/previewProductLink.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| generateAuraSwipeBatch | UPDATE / modified | `src/generateAuraSwipeBatch.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| generateOutfitRecommendations | UPDATE / modified | `src/ai/wardrobeIntelligence/outfitCallables.ts` | callable | OPENAI_API_KEY | 240 / default / default / default |
| generateOutfitsV1 | UPDATE / modified | `src/generateOutfitsV1.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| getAccountDeletionStatus | ADD / added | `src/deleteAccountData.ts` | callable | — | default / default / default / default |
| getAuraMetrics | UPDATE / unchanged | `src/ai/wardrobeIntelligence/metricsCallables.ts` | callable | — | 60 / default / default / default |
| getAuraResumeMetrics | UPDATE / unchanged | `src/ai/wardrobeIntelligence/metricsCallables.ts` | callable | — | 60 / default / default / default |
| getStyleProfile | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | — | 60 / default / default / default |
| health | UPDATE / unchanged | `src/index.ts` | https | — | default / default / default / default |
| importProductLink | UPDATE / modified | `src/importProductLink.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| ingestItemFromPhotos | UPDATE / modified | `src/ingestItemFromPhotos.ts` | event written users/{uid}/items/{itemId}; retry=true | OPENAI_API_KEY | 240 / 1024 / default / default |
| listStyleMemories | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | — | 60 / default / default / default |
| logAuraAgentOutfitWear | UPDATE / modified | `src/ai/wardrobeIntelligence/agentActionCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| onClosetItemWriteIndexIntelligence | UPDATE / modified | `src/ai/wardrobeIntelligence/triggers.ts` | event written users/{uid}/items/{itemId}; retry=true | — | 60 / default / default / default |
| outfitChatV1 | UPDATE / modified | `src/outfitChatV1.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| parseOutfitIntent | UPDATE / modified | `src/index.ts` | https | OPENAI_API_KEY | default / default / default / default |
| planAuraAgentOutfit | UPDATE / modified | `src/ai/wardrobeIntelligence/agentActionCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| polishExtractedAccessory | UPDATE / modified | `src/extractOutfitItems.ts` | callable | OPENAI_API_KEY | 240 / 1024 / default / default |
| polishProductImage | UPDATE / modified | `src/polishProductImage.ts` | callable | OPENAI_API_KEY | 120 / 1024 / default / default |
| prepareMediaWrite | ADD / added | `src/prepareMediaWrite.ts` | callable | — | 60 / default / default / default |
| previewAbandonedDraftCleanup | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | — | 120 / default / default / default |
| previewClosetItemIntelligence | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | — | 60 / default / default / default |
| previewOutfitGenerationContext | UPDATE / modified | `src/ai/wardrobeIntelligence/outfitCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| previewProductLink | UPDATE / unchanged | `src/previewProductLink.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| rebuildStyleProfileFromMemories | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | — | 120 / default / default / default |
| reconstructOutfitLayout | UPDATE / modified | `src/extractOutfitItems.ts` | callable | OPENAI_API_KEY | 540 / 1024 / default / default |
| recordOutfitFeedback | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| recoverAccountDeletions | ADD / added | `src/deleteAccountData.ts` | schedule every 5 minutes UTC | OPENAI_API_KEY | 540 / 512 / 1 / 1 |
| refreshAuraMetricsSnapshot | UPDATE / unchanged | `src/ai/wardrobeIntelligence/metricsCallables.ts` | callable | — | 120 / default / default / default |
| reindexClosetItem | UPDATE / modified | `src/ai/wardrobeIntelligence/callables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| removeDeletedAccountUpload | ADD / added | `src/deleteAccountData.ts` | event finalized default bucket; retry=true | — | default / default / default / default |
| resetAuraMetrics | UPDATE / unchanged | `src/ai/wardrobeIntelligence/metricsCallables.ts` | callable | — | 60 / default / default / default |
| resumeClosetAfterAiConsent | ADD / added | `src/aiConsent.ts` | event created users/{uid}/aiConsentJobs/{jobId}; retry=true | — | default / default / default / default |
| retrieveStyleMemoryContext | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| retrieveWardrobeContext | UPDATE / modified | `src/ai/wardrobeIntelligence/retrievalCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| revokeAppleForAccountDeletion | ADD / added | `src/revokeAppleForAccountDeletion.ts` | callable | APPLE_REVOCATION_PRIVATE_KEY | 60 / default / default / default |
| runAuraStylingAgent | UPDATE / modified | `src/ai/wardrobeIntelligence/agentCallables.ts` | callable | OPENAI_API_KEY | 240 / default / default / default |
| saveAuraAgentOutfit | UPDATE / modified | `src/ai/wardrobeIntelligence/agentActionCallables.ts` | callable | OPENAI_API_KEY | 120 / default / default / default |
| searchLiveProducts | UPDATE / modified | `src/products/searchLiveProducts.ts` | callable | — | default / default / default / default |
| setAiConsent | ADD / added | `src/aiConsent.ts` | callable | — | default / default / default / default |
| softDeleteAllStyleMemories | UPDATE / modified | `src/ai/wardrobeIntelligence/styleMemoryCallables.ts` | callable | — | 120 / default / default / default |
| transcribeAuraAudio | UPDATE / modified | `src/transcribeAuraAudio.ts` | callable | OPENAI_API_KEY | default / default / default / default |
| wrapAffiliateLinks | UPDATE / unchanged | `src/affiliate/affiliateLinks.ts` | callable | — | default / default / default / default |
