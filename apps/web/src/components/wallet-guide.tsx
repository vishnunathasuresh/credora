import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';

export function WalletGuide() {
  return (
    <Card className="wallet-guide">
      <CardHeader>
        <CardTitle>New to wallets? Start here.</CardTitle>
        <CardDescription>
          A wallet is your digital identity. Credora uses your public address to find your
          credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="wallet-steps">
          <li>
            <strong>Create a wallet.</strong>
            <p>
              Install an Ethereum-compatible wallet from its official website. Follow the wallet’s
              account setup and backup instructions. Your recovery phrase stays with you; never
              enter it in Credora.
            </p>
            <Button asChild variant="outline">
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">
                Get MetaMask
              </a>
            </Button>
          </li>
          <li>
            <strong>Give your public address to your issuer.</strong>
            <p>
              Copy the address beginning with 0x from your wallet. This is safe to share. The issuer
              must use this exact address when creating your credential.
            </p>
          </li>
          <li>
            <strong>Connect and sign in.</strong>
            <p>
              Unlock your wallet, choose Connect, and approve the sign-in message. Signing in proves
              you control your address. It does not send a transaction or cost gas.
            </p>
          </li>
        </ol>
        <p className="form-help">
          Checking and sharing credentials need no crypto purchase. Issuers pay network fees when
          recording a credential. A local Anvil network is for development only.
        </p>
        <Button asChild variant="link">
          <a href="/verify">Just checking a credential? Verify without a wallet.</a>
        </Button>
      </CardContent>
    </Card>
  );
}
