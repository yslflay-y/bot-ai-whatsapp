import { WhatsAppProvider } from "./whatsapp-provider.interface.js";

class WhatsAppProviderHolder {
  private provider: WhatsAppProvider | null = null;

  setProvider(provider: WhatsAppProvider): void {
    this.provider = provider;
  }

  getProvider(): WhatsAppProvider | null {
    return this.provider;
  }
}

export const whatsAppProviderHolder = new WhatsAppProviderHolder();
