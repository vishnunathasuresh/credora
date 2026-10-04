import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Share,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import {
  Button,
  H1,
  H2,
  Input,
  Paragraph,
  ScrollView,
  Separator,
  Spinner,
  TamaguiProvider,
  Text,
  XStack,
  YStack,
} from 'tamagui';
import config from './tamagui.config';
import { AppIcon } from './src/icons';
import {
  parseReference,
  readSavedCredentials,
  resultTitles,
  verifyCredential,
  type SavedCredential,
  type VerificationResult,
} from './src/credentials';

type Tab = 'wallet' | 'verify' | 'settings';
const libraryKey = 'credora-public-library-v1';
const settingsKey = 'credora-mobile-settings-v1';
const defaultApi = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const defaultWeb = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

function publicServer(value: string) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export default function App() {
  const dark = useColorScheme() === 'dark';
  return (
    <TamaguiProvider config={config} defaultTheme={dark ? 'dark' : 'light'}>
      <SafeAreaProvider>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <MobileApp />
      </SafeAreaProvider>
    </TamaguiProvider>
  );
}

function MobileApp() {
  const [tab, setTab] = useState<Tab>('wallet');
  const [library, setLibrary] = useState<SavedCredential[]>([]);
  const [ready, setReady] = useState(false);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [apiUrl, setApiUrl] = useState(defaultApi);
  const [webUrl, setWebUrl] = useState(defaultWeb);
  const [apiDraft, setApiDraft] = useState(defaultApi);
  const [webDraft, setWebDraft] = useState(defaultWeb);
  const [serverSettingsExpanded, setServerSettingsExpanded] = useState(false);
  const [reference, setReference] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [checkedHash, setCheckedHash] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [scan, setScan] = useState(false);
  const [present, setPresent] = useState<SavedCredential | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const requestId = useRef(0);
  const scanned = useRef(false);
  const verificationUrl = present ? `${webUrl.replace(/\/$/, '')}/verify/${present.hash}` : '';

  useEffect(() => {
    void (async () => {
      try {
        const [saved, settings] = await Promise.all([
          AsyncStorage.getItem(libraryKey),
          AsyncStorage.getItem(settingsKey),
        ]);
        setLibrary(readSavedCredentials(saved));
        setLibraryLoaded(true);
        if (settings) {
          const value = JSON.parse(settings);
          if (publicServer(value.apiUrl) && publicServer(value.webUrl)) {
            setApiUrl(value.apiUrl);
            setApiDraft(value.apiUrl);
            setWebUrl(value.webUrl);
            setWebDraft(value.webUrl);
          }
        }
      } catch {
        setNotice(
          'Saved data could not be loaded. Retry by reopening the app; your blockchain records are unchanged.',
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (scan) {
        setScan(false);
        return true;
      }
      if (present) {
        setPresent(null);
        return true;
      }
      if (tab !== 'wallet') {
        setTab('wallet');
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [scan, present, tab]);

  function changeReference(value: string) {
    requestId.current++;
    setBusy(false);
    setReference(value);
    setResult(null);
    setCheckedHash('');
    setNotice('');
  }

  async function verify(value = reference) {
    const hash = parseReference(value);
    if (!hash) {
      setNotice(
        'Paste a public /verify/ link or a credential hash beginning with 0x and containing 64 hexadecimal characters.',
      );
      return;
    }
    const id = ++requestId.current;
    setBusy(true);
    setResult(null);
    setNotice('');
    setCheckedHash('');
    const outcome = await verifyCredential(apiUrl, hash);
    if (id !== requestId.current) return;
    setCheckedHash(hash);
    setResult(outcome);
    setBusy(false);
  }

  async function store(next: SavedCredential[], message: string) {
    if (!libraryLoaded) {
      setNotice(
        'Your saved library has not loaded. Reopen the app to retry before saving or removing links.',
      );
      return;
    }
    try {
      await AsyncStorage.setItem(libraryKey, JSON.stringify(next));
      setLibrary(next);
      setNotice(message);
    } catch {
      setNotice('The library could not be saved on this device. Free some storage and retry.');
    }
  }

  async function saveCredential() {
    if (result?.state !== 'valid' || !checkedHash || !result.metadata || !ready || !libraryLoaded)
      return;
    if (library.length >= 100 && !library.some((item) => item.hash === checkedHash)) {
      setNotice('Your library holds 100 credentials. Remove a saved link before adding another.');
      return;
    }
    await store(
      [
        { hash: checkedHash, name: result.metadata.skillName, savedAt: new Date().toISOString() },
        ...library.filter((item) => item.hash !== checkedHash),
      ],
      'Credential link saved on this device.',
    );
  }

  async function download() {
    if (result?.state !== 'valid' || !result.metadata || !checkedHash) return;
    const payload = JSON.stringify(
      {
        credentialHash: checkedHash,
        verificationUrl: `${webUrl.replace(/\/$/, '')}/verify/${checkedHash}`,
        metadata: result.metadata,
        checkedAt: new Date().toISOString(),
        note: 'Public credential copy. Reverify against the registry; this file is not independent proof.',
      },
      null,
      2,
    );
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `credora-${checkedHash}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const file = new File(Paths.cache, `credora-${checkedHash}.json`);
        file.create({ overwrite: true });
        file.write(payload);
        if (!(await Sharing.isAvailableAsync())) {
          setNotice(
            'File sharing is unavailable on this device. Share the public verification link instead.',
          );
          return;
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save credential copy',
          UTI: 'public.json',
        });
      }
      setNotice(
        'Credential copy prepared. Anyone checking it should verify the public record again.',
      );
    } catch {
      setNotice('The credential copy could not be exported. Retry or share its verification link.');
    }
  }

  async function startScan() {
    setNotice('');
    scanned.current = false;
    try {
      const access = permission?.granted ? permission : await requestPermission();
      if (access.granted) setScan(true);
      else
        setNotice(
          'Camera permission is off. Enable it in your device settings, or paste a verification link.',
        );
    } catch {
      setNotice('The camera could not be opened. Paste the credential link instead.');
    }
  }

  async function share() {
    try {
      await Share.share({ message: verificationUrl, title: present?.name });
    } catch {
      setNotice('Sharing is unavailable. You can show the QR code instead.');
    }
  }

  async function openWallet() {
    try {
      await Linking.openURL(`${webUrl.replace(/\/$/, '')}/wallet`);
    } catch {
      setNotice('Could not open the wallet page. Check the website address in Settings.');
    }
  }

  async function saveSettings() {
    if (!publicServer(apiDraft) || !publicServer(webDraft)) {
      setNotice(
        'Enter an http or https server address without passwords, query parameters, or fragments.',
      );
      return;
    }
    try {
      const values = {
        apiUrl: apiDraft.trim().replace(/\/$/, ''),
        webUrl: webDraft.trim().replace(/\/$/, ''),
      };
      await AsyncStorage.setItem(settingsKey, JSON.stringify(values));
      requestId.current++;
      setBusy(false);
      setResult(null);
      setCheckedHash('');
      setApiUrl(values.apiUrl);
      setWebUrl(values.webUrl);
      setNotice('Server addresses saved.');
    } catch {
      setNotice('Settings could not be saved. Retry when device storage is available.');
    }
  }

  return (
    <YStack flex={1} backgroundColor="$background">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <XStack
            padding="$4"
            justifyContent="space-between"
            alignItems="center"
            borderBottomWidth={1}
            borderColor="$borderColor"
          >
            <Text fontSize={22} fontWeight="700" color="$color">
              credora
            </Text>
            <Text color="$color" fontSize={14}>
              Public credentials
            </Text>
          </XStack>
          <ScrollView
            flex={1}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            <YStack
              width="100%"
              maxWidth={720}
              alignSelf="center"
              padding="$5"
              gap="$5"
              paddingBottom="$7"
            >
              {scan ? (
                <YStack gap="$4">
                  <H1 fontSize={30}>Scan a credential</H1>
                  <Paragraph>
                    Point at a Credora verification QR. The code is read as a reference; no website
                    is opened automatically.
                  </Paragraph>
                  <CameraView
                    style={{ height: 320, width: '100%', borderRadius: 12 }}
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={({ data }) => {
                      if (scanned.current) return;
                      scanned.current = true;
                      setScan(false);
                      const hash = parseReference(data);
                      if (!hash) {
                        setNotice(
                          'This QR is not a Credora credential link. Paste a valid reference or scan another code.',
                        );
                        return;
                      }
                      changeReference(hash);
                      setTab('verify');
                      void verify(hash);
                    }}
                  />
                  <Button minHeight={48} onPress={() => setScan(false)}>
                    Cancel scan
                  </Button>
                </YStack>
              ) : present ? (
                <YStack gap="$4">
                  <Button minHeight={48} onPress={() => setPresent(null)}>
                    Back to credentials
                  </Button>
                  <H1 fontSize={30}>{present.name}</H1>
                  <Paragraph>
                    Show this code to a verifier. They will check the latest public record. A saved
                    link alone does not prove validity or wallet ownership.
                  </Paragraph>
                  <YStack
                    alignItems="center"
                    padding="$4"
                    backgroundColor="white"
                    borderRadius="$4"
                  >
                    <QRCode
                      value={verificationUrl}
                      size={240}
                      color="black"
                      backgroundColor="white"
                    />
                  </YStack>
                  <Text selectable color="$color" fontSize={13}>
                    {present.hash}
                  </Text>
                  <Button themeInverse minHeight={48} onPress={share}>
                    Share verification link
                  </Button>
                  <Button
                    minHeight={48}
                    onPress={() => {
                      changeReference(present.hash);
                      setPresent(null);
                      setTab('verify');
                      void verify(present.hash);
                    }}
                  >
                    Check current record
                  </Button>
                </YStack>
              ) : tab === 'wallet' ? (
                <>
                  <YStack gap="$2">
                    <H1 fontSize={32}>Your credentials</H1>
                    <Paragraph color="$color">
                      Save a credential link, carry it with you, and show its QR when someone needs
                      to check it.
                    </Paragraph>
                  </YStack>
                  {!ready ? (
                    <Spinner accessibilityLabel="Loading saved credentials" />
                  ) : !libraryLoaded ? (
                    <YStack gap="$3">
                      <H2 fontSize={22}>Saved library unavailable</H2>
                      <Paragraph>
                        Reopen the app to retry. Saving and removing links are paused to protect
                        your existing library.
                      </Paragraph>
                      <Button minHeight={48} onPress={() => setTab('verify')}>
                        Verify without saving
                      </Button>
                    </YStack>
                  ) : library.length === 0 ? (
                    <YStack
                      gap="$3"
                      borderWidth={1}
                      borderColor="$borderColor"
                      borderRadius="$4"
                      padding="$5"
                    >
                      <H2 fontSize={22}>Your library is empty</H2>
                      <Paragraph>
                        Ask your issuer for your public verification link. Add it here after
                        checking the record.
                      </Paragraph>
                      <Button
                        themeInverse
                        minHeight={48}
                        onPress={() => {
                          setTab('verify');
                          changeReference('');
                        }}
                      >
                        Add a credential
                      </Button>
                      <Button minHeight={48} icon={<AppIcon name="scan" />} onPress={startScan}>
                        Scan a QR code
                      </Button>
                    </YStack>
                  ) : (
                    <YStack gap="$4">
                      {library.map((item) => (
                        <YStack
                          key={item.hash}
                          gap="$3"
                          paddingVertical="$4"
                          borderBottomWidth={1}
                          borderColor="$borderColor"
                        >
                          <H2 fontSize={22}>{item.name}</H2>
                          <Paragraph>
                            Saved link · check the current record before relying on it
                          </Paragraph>
                          <Text color="$color" fontSize={12} selectable>
                            {item.hash}
                          </Text>
                          <XStack flexWrap="wrap" gap="$2">
                            <Button
                              themeInverse
                              minHeight={48}
                              onPress={() => {
                                setPresent(item);
                                setNotice('');
                              }}
                              accessibilityLabel={`Show QR for ${item.name}`}
                            >
                              Show QR
                            </Button>
                            <Button
                              minHeight={48}
                              onPress={() => {
                                changeReference(item.hash);
                                setTab('verify');
                                void verify(item.hash);
                              }}
                            >
                              Verify credential
                            </Button>
                            <Button
                              minHeight={48}
                              onPress={() =>
                                store(
                                  library.filter((value) => value.hash !== item.hash),
                                  'Saved link removed from this device. The issued credential is unchanged.',
                                )
                              }
                              accessibilityLabel={`Remove saved link for ${item.name}`}
                            >
                              Remove link
                            </Button>
                          </XStack>
                        </YStack>
                      ))}
                      <Button
                        minHeight={48}
                        onPress={() => {
                          setTab('verify');
                          changeReference('');
                        }}
                      >
                        Add another credential
                      </Button>
                    </YStack>
                  )}
                  <YStack gap="$3">
                    <H2 fontSize={22}>Have credentials in a wallet?</H2>
                    <Paragraph>
                      Open Credora’s wallet page in your wallet app’s browser, connect, and sign the
                      login message. Copy a credential link into this library. This app does not
                      store private keys or connect to a signing wallet.
                    </Paragraph>
                    <Button minHeight={48} onPress={openWallet}>
                      Open holder wallet on web
                    </Button>
                    <Paragraph fontSize={14}>
                      Saved links stay on this device. Verification needs an internet connection.
                    </Paragraph>
                  </YStack>
                </>
              ) : tab === 'verify' ? (
                <>
                  <YStack gap="$2">
                    <H1 fontSize={32}>Verify a credential</H1>
                    <Paragraph>
                      No wallet, account, or network fee required. Check whether credential details
                      match the public blockchain record.
                    </Paragraph>
                  </YStack>
                  <YStack gap="$3">
                    <Text color="$color" fontWeight="600" nativeID="reference-label">
                      Credential link or hash
                    </Text>
                    <Input
                      accessibilityLabel="Credential link or hash"
                      accessibilityLabelledBy="reference-label"
                      minHeight={52}
                      value={reference}
                      onChangeText={changeReference}
                      placeholder="Paste /verify/ link or 0x hash"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={() => verify()}
                    />
                    <Paragraph fontSize={14}>
                      Use the link from your issuer, or scan the QR on their credential.
                    </Paragraph>
                    <Button themeInverse minHeight={48} disabled={busy} onPress={() => verify()}>
                      {busy ? 'Checking public record…' : 'Verify credential'}
                    </Button>
                    <Button
                      minHeight={48}
                      disabled={busy}
                      icon={<AppIcon name="scan" />}
                      onPress={startScan}
                    >
                      Scan QR code
                    </Button>
                  </YStack>
                  {busy ? <Spinner accessibilityLabel="Checking credential" /> : null}
                  {result ? (
                    <YStack
                      gap="$3"
                      padding="$5"
                      borderWidth={1}
                      borderColor="$borderColor"
                      borderRadius="$4"
                      accessibilityLiveRegion="polite"
                    >
                      <H2 fontSize={22}>{resultTitles[result.state]}</H2>
                      <Paragraph>{result.message}</Paragraph>
                      {result.state === 'valid' && result.metadata ? (
                        <>
                          <Separator />
                          <Text color="$color" fontSize={23} fontWeight="600">
                            {result.metadata.skillName}
                          </Text>
                          <Paragraph>
                            {result.metadata.skillLevel} ·{' '}
                            {new Date(result.metadata.issueDate).toLocaleDateString()}
                          </Paragraph>
                          <Text color="$color" fontSize={13} selectable>
                            Issuer: {result.metadata.issuerAddress}
                          </Text>
                          <Text color="$color" fontSize={13} selectable>
                            Holder: {result.metadata.learnerAddress}
                          </Text>
                          <Button
                            minHeight={48}
                            disabled={!ready || !libraryLoaded}
                            onPress={saveCredential}
                          >
                            {library.some((item) => item.hash === checkedHash)
                              ? 'Update saved link'
                              : 'Save to my credentials'}
                          </Button>
                          <Button
                            themeInverse
                            minHeight={48}
                            icon={<AppIcon name="download" />}
                            onPress={download}
                          >
                            Download credential JSON
                          </Button>
                          <Paragraph fontSize={13}>
                            Download contains public details. It is a copy, not a new credential or
                            an offline verification result.
                          </Paragraph>
                        </>
                      ) : (
                        <Button minHeight={48} onPress={() => verify()}>
                          Try again
                        </Button>
                      )}
                    </YStack>
                  ) : null}
                </>
              ) : (
                <>
                  <H1 fontSize={32}>Setup & help</H1>
                  <H2 fontSize={22}>You can start without a wallet</H2>
                  <Paragraph>
                    Verifiers only read public records. Holders can save links and show QR codes
                    here. To find credentials issued to your address, use a wallet to sign in on the
                    web.
                  </Paragraph>
                  <H2 fontSize={22}>Create your wallet</H2>
                  <Paragraph>
                    Install an Ethereum-compatible wallet from its official website, create an
                    account, and follow its backup instructions. Never enter a recovery phrase or
                    private key in Credora.
                  </Paragraph>
                  <Button
                    minHeight={48}
                    onPress={() => {
                      void Linking.openURL('https://metamask.io/download/').catch(() =>
                        setNotice('Could not open the wallet website.'),
                      );
                    }}
                  >
                    Get MetaMask from its official site
                  </Button>
                  <Paragraph>
                    Share your public 0x address with your issuer. In your wallet’s browser, open
                    the Credora website and sign the login message. Signing in does not cost gas.
                  </Paragraph>
                  <Separator />
                  <Button
                    minHeight={48}
                    accessibilityState={{ expanded: serverSettingsExpanded }}
                    accessibilityHint="Shows the API and website addresses used by this app."
                    onPress={() => setServerSettingsExpanded((expanded) => !expanded)}
                  >
                    {serverSettingsExpanded
                      ? 'Hide development server settings'
                      : 'Show development server settings'}
                  </Button>
                  {serverSettingsExpanded ? (
                    <YStack gap="$3">
                      <H2 fontSize={22}>Development servers</H2>
                      <Paragraph>
                        On a phone, localhost points to the phone. Use your computer’s LAN address
                        and keep both devices on the same Wi-Fi. For a deployed service, use HTTPS.
                        These addresses select which service and registry you trust.
                      </Paragraph>
                      <Text color="$color" fontWeight="600">
                        API server
                      </Text>
                      <Input
                        accessibilityLabel="API server address"
                        minHeight={52}
                        value={apiDraft}
                        onChangeText={setApiDraft}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                      <Text color="$color" fontWeight="600">
                        Public website
                      </Text>
                      <Input
                        accessibilityLabel="Public website address"
                        minHeight={52}
                        value={webDraft}
                        onChangeText={setWebDraft}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                      />
                      <Button themeInverse minHeight={48} disabled={!ready} onPress={saveSettings}>
                        Save server addresses
                      </Button>
                    </YStack>
                  ) : null}
                </>
              )}
              {notice ? (
                <Paragraph
                  accessibilityLiveRegion="polite"
                  role="status"
                  borderWidth={1}
                  borderColor="$borderColor"
                  borderRadius="$4"
                  padding="$4"
                >
                  {notice}
                </Paragraph>
              ) : null}
            </YStack>
          </ScrollView>
          {!scan && !present ? (
            <XStack
              accessibilityRole="tablist"
              padding="$3"
              gap="$2"
              borderTopWidth={1}
              borderColor="$borderColor"
            >
              {(['wallet', 'verify', 'settings'] as Tab[]).map((value) => (
                <Button
                  key={value}
                  flex={1}
                  minHeight={64}
                  themeInverse={tab === value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === value }}
                  onPress={() => {
                    setTab(value);
                    setNotice('');
                  }}
                >
                  <YStack alignItems="center" gap="$1">
                    <AppIcon name={value} size={20} />
                    <Text color="$color" fontSize={12}>
                      {value === 'wallet' ? 'Credentials' : value === 'verify' ? 'Verify' : 'Setup'}
                    </Text>
                  </YStack>
                </Button>
              ))}
            </XStack>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </YStack>
  );
}
