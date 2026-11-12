import OpenAI from "openai";
import { consentedProviderFetch } from "./aiConsent";

// Replacing the transport also covers SDK retries and helper/streaming APIs.
export default class ConsentedOpenAI extends OpenAI {
  constructor(options: ConstructorParameters<typeof OpenAI>[0]) {
    super({ ...options, fetch: consentedProviderFetch });
  }
}
