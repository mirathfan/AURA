import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getItemImageUrl } from "../../src/lib/itemImage";
import { ClothingItem } from "../../src/types/ClothingItem";
import FlatLayCanvas from "./outfit/FlatLayCanvas";

type SlotName = "outerwear" | "top" | "bottom" | "shoes";

type Props = {
  slots: Record<SlotName, ClothingItem | null>;
  title: string;
  onUse: () => void;
  onWhy: () => void;
};

export default function OutfitPreviewCard({ slots, title, onUse, onWhy }: Props) {
  const outfitItems = (
    Object.entries(slots) as [SlotName, ClothingItem | null][]
  ).flatMap(([slotKey, item]) =>
    item == null
      ? []
      : [
          {
            id: item.id,
            category: slotKey,
            imageUrl: getItemImageUrl(item, { variant: "thumb" }) || null,
          },
        ]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <FlatLayCanvas items={outfitItems} />
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onUse}>
          <Text style={styles.primaryBtnText}>Use this outfit</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onWhy}>
          <Text style={styles.secondaryBtnText}>Why?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  secondaryBtn: {
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#111",
    fontWeight: "800",
  },
});
