import { Camera, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function CameraPermissionDialog({ open, onOpenChange, onContinue }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </div>
          <AlertDialogTitle>Use your camera to record a Peek?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left leading-6">
            <span className="block">
              PeekaListing will open your device camera so you can record the Peek you chose to add. Your browser or operating system may ask for camera and microphone access.
            </span>
            <span className="flex items-start gap-2 rounded-xl border border-border bg-surface-secondary p-3 text-xs text-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              Recording stays on your device until you review it and explicitly upload it. PeekaListing does not start the camera in the background.
            </span>
            <span className="block text-xs">
              Microphone access is used only for the video’s audio. You can cancel the camera without selecting or uploading anything.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={onContinue}>Continue to camera</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
