import { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator } from 'react-native';
import QRCode from 'qrcode';
import { colors } from '@shared/design/tokens';

interface QrCodeImageProps {
  value: string;
  size: number;
}

/** QR görüntüsü — SVG yerine data URL; web/mobilde güvenilir render */
export function QrCodeImage({ value, size }: QrCodeImageProps) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setFailed(false);

    void QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: colors.ex.red, light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    })
      .then(data => { if (!cancelled) setUri(data); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [value, size]);

  if (failed) {
    return <View style={{ width: size, height: size }} className="bg-cream-100 rounded-xl" />;
  }

  if (!uri) {
    return (
      <View style={{ width: size, height: size }} className="items-center justify-center bg-cream-50 rounded-xl">
        <ActivityIndicator size="small" color={colors.ex.red} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
