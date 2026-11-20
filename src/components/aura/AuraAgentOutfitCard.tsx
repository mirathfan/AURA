import React from "react";

import type { AppColors } from "@/constants/theme";
import AuraAgentOldStyleOutfitCard from "@/src/components/aura/AuraAgentOldStyleOutfitCard";
import type { ClothingItem } from "@/src/types/ClothingItem";
import type { AuraAgentOutfit, AuraAgentSuggestedAction } from "@/src/types/auraAgent";

export default function AuraAgentOutfitCard({
  colors,
  itemsById,
  outfit,
  selected = false,
  showSelectedIndicator = false,
  onPress,
  actions,
  onAction,
  actionsDisabled = false,
  loadingActionId = null,
  compact = false,
  showDetails = true,
  showDevDetails = true,
}: {
  colors: AppColors;
  itemsById?: Map<string, ClothingItem>;
  outfit: AuraAgentOutfit;
  selected?: boolean;
  showSelectedIndicator?: boolean;
  onPress?: () => void;
  actions?: AuraAgentSuggestedAction[];
  onAction?: (action: AuraAgentSuggestedAction) => void;
  actionsDisabled?: boolean;
  loadingActionId?: string | null;
  compact?: boolean;
  showDetails?: boolean;
  showDevDetails?: boolean;
}) {
  return (
    <AuraAgentOldStyleOutfitCard
      colors={colors}
      itemsById={itemsById}
      outfit={outfit}
      selected={selected}
      showSelectedIndicator={showSelectedIndicator}
      onSelect={onPress}
      actions={actions}
      onAction={onAction}
      actionsDisabled={actionsDisabled}
      loadingActionId={loadingActionId}
      compact={compact}
      showDetails={showDetails}
      showDevDetails={showDevDetails}
    />
  );
}
