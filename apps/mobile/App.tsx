import { useState } from 'react';
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const ink = '#252620';
const paper = '#f6f1e7';
const muted = '#706d63';
const green = '#407a5e';

export default function App() {
  const [reference, setReference] = useState('');
  const valid = /^0x[0-9a-fA-F]{64}$/.test(reference.trim());

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>C</Text>
          </View>
          <Text style={styles.brand}>credora</Text>
          <Text style={styles.status}>offline-ready</Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR CREDENTIAL WALLET</Text>
          <Text style={styles.title}>Work worth carrying.</Text>
          <Text style={styles.subtitle}>
            Keep your credentials close. Share a proof when it matters.
          </Text>
        </View>
        <View style={styles.walletCard}>
          <View style={styles.cardTop}>
            <Text style={styles.cardLabel}>MY WALLET</Text>
            <Text style={styles.cardCount}>02 credentials</Text>
          </View>
          <Text style={styles.credentialTitle}>Systems thinking</Text>
          <Text style={styles.credentialMeta}>Advanced · Northstar Institute</Text>
          <View style={styles.cardLine} />
          <View style={styles.cardBottom}>
            <Text style={styles.verified}>● VERIFIED</Text>
            <Text style={styles.cardArrow}>↗</Text>
          </View>
        </View>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Verify a credential</Text>
          <Text style={styles.sectionHint}>No wallet required</Text>
        </View>
        <TextInput
          style={styles.input}
          value={reference}
          onChangeText={setReference}
          placeholder="Paste credential hash"
          placeholderTextColor="#9c988c"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.button, !valid && styles.buttonDisabled]}
          disabled={!valid}
          onPress={() => Linking.openURL(`https://credora.local/verify/${reference.trim()}`)}
        >
          <Text style={styles.buttonText}>CHECK THE RECORD ↗</Text>
        </Pressable>
        <View style={styles.footer}>
          <Text style={styles.footerText}>Credora protocol</Text>
          <Text style={styles.footerText}>Portable · Open · Yours</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: paper, flex: 1 },
  content: { padding: 24, paddingBottom: 50 },
  header: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  brandMark: {
    alignItems: 'center',
    backgroundColor: ink,
    borderRadius: 20,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  brandMarkText: { color: paper, fontFamily: 'Georgia', fontSize: 18 },
  brand: { color: ink, fontSize: 18, fontWeight: '800', letterSpacing: -1, marginLeft: 9 },
  status: {
    color: muted,
    fontSize: 10,
    letterSpacing: 1,
    marginLeft: 'auto',
    textTransform: 'uppercase',
  },
  hero: { paddingBottom: 38, paddingTop: 68 },
  eyebrow: { color: green, fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 16 },
  title: {
    color: ink,
    fontFamily: 'Georgia',
    fontSize: 47,
    letterSpacing: -2,
    lineHeight: 48,
    maxWidth: 320,
  },
  subtitle: { color: muted, fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 320 },
  walletCard: { backgroundColor: '#e3ebdf', borderColor: '#b7cdb9', borderWidth: 1, padding: 22 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: green, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  cardCount: { color: muted, fontSize: 11 },
  credentialTitle: { color: ink, fontFamily: 'Georgia', fontSize: 28, marginTop: 48 },
  credentialMeta: { color: muted, fontSize: 13, marginTop: 7 },
  cardLine: { borderTopColor: '#b7cdb9', borderTopWidth: 1, marginTop: 42 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  verified: { color: green, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardArrow: { color: green, fontSize: 18 },
  sectionHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 62,
  },
  sectionTitle: { color: ink, fontFamily: 'Georgia', fontSize: 24 },
  sectionHint: { color: muted, fontSize: 11 },
  input: {
    borderBottomColor: '#cfc7b7',
    borderBottomWidth: 1,
    color: ink,
    fontSize: 15,
    paddingVertical: 16,
  },
  button: { alignItems: 'center', backgroundColor: ink, marginTop: 20, padding: 17 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: paper, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  footer: {
    borderTopColor: '#d9d0c1',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 78,
    paddingTop: 18,
  },
  footerText: { color: muted, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase' },
});
