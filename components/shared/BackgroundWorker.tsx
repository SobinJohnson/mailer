'use client';

import { useEffect } from 'react';

export function BackgroundWorker() {
  useEffect(() => {
    let sendProcessInterval: NodeJS.Timeout;
    let imapSyncInterval: NodeJS.Timeout;

    // Helper to check if enough time has passed across all open tabs
    const shouldRunTask = (taskName: string, intervalMs: number) => {
      const lastRun = localStorage.getItem(`lastRun_${taskName}`);
      const now = Date.now();
      if (!lastRun || now - parseInt(lastRun, 10) > intervalMs) {
        localStorage.setItem(`lastRun_${taskName}`, now.toString());
        return true;
      }
      return false;
    };

    const runProcessQueue = async () => {
      // 2 minutes minimum between queue processing
      if (!shouldRunTask('queue', 2 * 60 * 1000)) return;
      try {
        await fetch('/api/send/manual', { method: 'POST' });
      } catch (err) {
        console.error('Queue processing error:', err);
      }
    };

    const runImapSync = async () => {
      // 5 minutes minimum between IMAP syncs
      if (!shouldRunTask('imap', 5 * 60 * 1000)) return;
      try {
        await fetch('/api/sync/manual', { method: 'POST' });
      } catch (err) {
        console.error('IMAP sync error:', err);
      }
    };

    // Run queue processing every 2 minutes
    sendProcessInterval = setInterval(runProcessQueue, 2 * 60 * 1000);
    setTimeout(runProcessQueue, 5000); // Initial check

    // Run IMAP sync every 5 minutes
    imapSyncInterval = setInterval(runImapSync, 5 * 60 * 1000);
    setTimeout(runImapSync, 10000); // Initial check

    return () => {
      clearInterval(sendProcessInterval);
      clearInterval(imapSyncInterval);
    };
  }, []);

  return null; // This component is invisible
}
