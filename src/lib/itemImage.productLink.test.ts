import { getBestThumbnailImageSource } from "./itemImage";

it("displays a retailer original on Closet cards when a derived thumbnail is absent", () => {
  const original = "https://image.hm.com/assets/hm/c7/94/garment.jpg?imwidth=768";
  const product = { source: "product_link", photos: { primaryUrl: original } };
  expect(getBestThumbnailImageSource(product)).toEqual({ uri: original });
  const thumb = "https://image.hm.com/assets/garment-thumb.jpg";
  expect(getBestThumbnailImageSource({ ...product, photos: { primaryUrl: original, thumbUrl: thumb } })).toEqual({ uri: thumb });
});
