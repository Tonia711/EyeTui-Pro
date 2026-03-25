import { ReceivePanel } from "../components/ReceivePanel";

interface ReceivingPageProps {
  onUploadSuccess: () => void;
}

export function ReceivingPage({ onUploadSuccess }: ReceivingPageProps) {
  return <ReceivePanel onUploadSuccess={onUploadSuccess} />;
}
