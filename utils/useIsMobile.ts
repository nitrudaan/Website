/**
 * Mobile Detection Hook
 * Provides device detection for conditional rendering and performance optimization
 */

import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  isLowEnd: boolean;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
}

/**
 * Detect if device is mobile based on screen width and user agent
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  });

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Detect if device is a tablet
 */
export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    return width >= 768 && width < 1024;
  });

  useEffect(() => {
    const check = () => {
      const width = window.innerWidth;
      setIsTablet(width >= 768 && width < 1024);
    };

    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return isTablet;
}

/**
 * Detect if device supports touch
 */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouch(touch);
  }, []);

  return isTouch;
}

/**
 * Detect if device is low-end (for performance optimizations)
 * Checks: low memory, low CPU cores, high pixel ratio with small screen
 */
export function useIsLowEnd(): boolean {
  const [isLowEnd, setIsLowEnd] = useState(() => {
    if (typeof window === 'undefined') return false;
    
    const nav = navigator as any;
    
    // Check device memory (if available)
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4;
    
    // Check hardware concurrency (CPU cores)
    const lowCores = nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4;
    
    // Check if mobile with high pixel ratio (stresses GPU)
    const mobileHighDPR = window.innerWidth < 768 && window.devicePixelRatio > 2;
    
    // Check connection type if available
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const slowConnection = connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
    
    return lowMemory || lowCores || mobileHighDPR || slowConnection;
  });

  useEffect(() => {
    const nav = navigator as any;
    const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory < 4;
    const lowCores = nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4;
    const mobileHighDPR = window.innerWidth < 768 && window.devicePixelRatio > 2;
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
    const slowConnection = connection && (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g');
    
    setIsLowEnd(lowMemory || lowCores || mobileHighDPR || slowConnection);
  }, []);

  return isLowEnd;
}

/**
 * Comprehensive device info hook
 */
export function useDeviceInfo(): DeviceInfo {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isTouch = useIsTouch();
  const isLowEnd = useIsLowEnd();
  
  const [dimensions, setDimensions] = useState({
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1920,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 1080,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
  });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        pixelRatio: window.devicePixelRatio,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return {
    isMobile,
    isTablet,
    isTouch,
    isLowEnd,
    ...dimensions,
  };
}

/**
 * Get mobile-optimized Three.js settings
 */
export function getMobileThreeSettings(isLowEnd: boolean, isMobile: boolean) {
  if (isLowEnd) {
    return {
      dpr: 1,
      particleCount: 100,
      starCount: 500,
      shadowMapEnabled: false,
      antialias: false,
      fps: 30,
    };
  }
  
  if (isMobile) {
    return {
      dpr: Math.min(window.devicePixelRatio, 1.5),
      particleCount: 300,
      starCount: 1500,
      shadowMapEnabled: false,
      antialias: false,
      fps: 60,
    };
  }
  
  return {
    dpr: Math.min(window.devicePixelRatio, 2),
    particleCount: 1000,
    starCount: 5000,
    shadowMapEnabled: true,
    antialias: true,
    fps: 60,
  };
}

export default useIsMobile;
