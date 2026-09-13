class WhatsAppProviderHolder {
    provider = null;
    setProvider(provider) {
        this.provider = provider;
    }
    getProvider() {
        return this.provider;
    }
}
export const whatsAppProviderHolder = new WhatsAppProviderHolder();
