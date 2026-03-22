import { useEffect, useRef, useState, useCallback } from 'react';

// Hook: useDeviceTilt
// Returns normalized tilt values in range [-1, 1] for x (left-right / gamma) and y (front-back / beta)
// Also exposes whether deviceorientation is available, whether permission is required (iOS), and a requestPermission function.

export default function useDeviceTilt(opts?: { smoothing?: number }) {
  const smoothing = opts?.smoothing ?? 0.15;
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [gamma, setGamma] = useState(0); // left-right tilt (-90..90)
  const [beta, setBeta] = useState(0); // front-back tilt (-180..180)

  const smoothed = useRef({ x: 0, y: 0 });

  // Map raw degrees to normalized -1..1
  const normalize = (value: number, maxAbs = 45) => {
    // clamp and normalize
    const clamped = Math.max(-maxAbs, Math.min(maxAbs, value));
    return clamped / maxAbs;
  };

  const onDeviceOrientation = useCallback((e: DeviceOrientationEvent) => {
    // Some browsers supply gamma (left-right) and beta (front-back)
    let g = e.gamma ?? 0;
    let b = e.beta ?? 0;

    // Normalize (use smaller ranges for more sensitive mapping)
    const nx = normalize(g, 30); // gamma typically -90..90; use 30deg as full tilt
    const ny = normalize(b - 90, 30); // beta 0..180 on some devices; center around 90

    // Smooth
    smoothed.current.x += (nx - smoothed.current.x) * smoothing;
    smoothed.current.y += (ny - smoothed.current.y) * smoothing;

    setGamma(smoothed.current.x);
    setBeta(smoothed.current.y);
  }, [smoothing]);

  useEffect(() => {
    // Feature detection
    if (typeof window === 'undefined') return;

    const hasEvent = 'DeviceOrientationEvent' in window;
    setAvailable(hasEvent);

    // On iOS 13+ deviceorientation requires user permission
    const needPermission = (typeof (DeviceOrientationEvent as any).requestPermission === 'function');
    setPermissionRequired(needPermission);

    // If permission not required, we can enable immediately and attach listener
    if (hasEvent && !needPermission) {
      window.addEventListener('deviceorientation', onDeviceOrientation, true);
      setEnabled(true);
    }

    return () => {
      window.removeEventListener('deviceorientation', onDeviceOrientation, true);
    };
  }, [onDeviceOrientation]);

  // Request permission (for iOS)
  const requestPermission = useCallback(async () => {
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      try {
        const res = await (DeviceOrientationEvent as any).requestPermission();
        if (res === 'granted') {
          window.addEventListener('deviceorientation', onDeviceOrientation, true);
          setEnabled(true);
          return true;
        }
      } catch (err) {
        return false;
      }
    }
    return false;
  }, [onDeviceOrientation]);

  return {
    available,
    enabled,
    permissionRequired,
    requestPermission,
    gamma, // normalized -1..1
    beta,  // normalized -1..1
  } as const;
}
