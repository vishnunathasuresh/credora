import { HugeiconsIcon } from '@hugeicons/react-native';
import Wallet01Icon from '@hugeicons/core-free-icons/Wallet01Icon';
import CheckmarkCircle02Icon from '@hugeicons/core-free-icons/CheckmarkCircle02Icon';
import Settings01Icon from '@hugeicons/core-free-icons/Settings01Icon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Download01Icon from '@hugeicons/core-free-icons/Download01Icon';
import { useTheme } from 'tamagui';

const icons = {
  wallet: Wallet01Icon,
  verify: CheckmarkCircle02Icon,
  settings: Settings01Icon,
  scan: QrCodeIcon,
  download: Download01Icon,
};
export function AppIcon({
  name,
  size = 20,
  color,
}: {
  name: keyof typeof icons;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size={size}
      color={color ?? theme.color.get()}
      strokeWidth={1.8}
      accessible={false}
    />
  );
}
