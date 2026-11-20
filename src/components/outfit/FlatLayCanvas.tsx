import React from "react";
import { Image, StyleSheet, View } from "react-native";

import { FlatLayItem, computeFlatLayLayout } from "./flatLayLayout";

type Props = {
  items: FlatLayItem[];
};

export default function FlatLayCanvas({ items }: Props) {
  const validItems = items.filter((i) => !!i.imageUrl);

  return (
    <View style={styles.container}>
      {/*
       * paddingTop: '75%' on the outer View gives it a 4:3 aspect ratio that
       * scales with the card width across all screen sizes (SE → Pro Max).
       * The inner canvas is absolutely pinned to fill that padded space, and
       * all item Images are absolutely positioned within it using percentages.
       */}
      <View style={styles.paddingBox}>
        <View style={styles.canvas}>
          {validItems.length <= 1 ? (
            validItems[0] ? (
              <Image
                source={{ uri: validItems[0].imageUrl! }}
                style={styles.singleItem}
                resizeMode="contain"
              />
            ) : null
          ) : (
            computeFlatLayLayout(items).map(({ item, style }) => (
              <Image
                key={item.id}
                source={{ uri: item.imageUrl! }}
                style={[
                  styles.itemBase,
                  {
                    top: style.top,
                    left: style.left,
                    width: style.width,
                    height: style.height,
                    zIndex: style.zIndex,
                  },
                ]}
                resizeMode="contain"
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F5F2ED",
  },
  paddingBox: {
    paddingTop: "75%",
    position: "relative",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  itemBase: {
    position: "absolute",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  singleItem: {
    position: "absolute",
    top: "20%",
    left: "20%",
    width: "60%",
    height: "60%",
  },
});
