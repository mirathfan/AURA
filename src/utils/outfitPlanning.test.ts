import { weatherSuggestion } from "./outfitPlanning";

jest.mock("@/src/lib/items", () => ({}));

describe("weather advice", () => {
  it.each([undefined, NaN, Infinity])("does not invent conditions without weather data (%s)", (temperature) => {
    expect(weatherSuggestion(temperature)).toBe("Check the forecast before choosing your layers.");
  });

  it("keeps advice for observed cold, wet, windy, and mild conditions", () => {
    expect(weatherSuggestion(0)).toContain("Cold");
    expect(weatherSuggestion(undefined, "Rain")).toContain("Wet");
    expect(weatherSuggestion(undefined, "Windy")).toContain("Windy");
    expect(weatherSuggestion(20, "Clear")).toContain("Good conditions");
  });
});
