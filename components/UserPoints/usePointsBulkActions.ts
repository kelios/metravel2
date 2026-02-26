import { useCallback, useEffect, useMemo, useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { userPointsApi } from '@/api/userPoints';
import { PointStatus } from '@/types/userPoints';

type PointLike = { id?: unknown };

type Params = {
  filteredPoints: PointLike[];
  queryClient: QueryClient;
};

export const usePointsBulkActions = ({ filteredPoints, queryClient }: Params) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkColor, setBulkColor] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<PointStatus | null>(null);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (!selectionMode) return;
    const visible = new Set(
      filteredPoints
        .map((p) => Number((p as { id?: unknown })?.id))
        .filter((id) => Number.isFinite(id))
    );
    setSelectedIds((prev) => prev.filter((id) => visible.has(id)));
  }, [filteredPoints, selectionMode]);

  const toggleSelect = useCallback((point: PointLike) => {
    const id = Number(point?.id);
    if (!Number.isFinite(id)) return;
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShowBulkEdit(false);
    setBulkColor(null);
    setBulkStatus(null);
  }, []);

  const startSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds([]);
  }, []);

  const applyBulkEdit = useCallback(async () => {
    if (!selectedIds.length) return;
    const updates: Record<string, unknown> = {};
    if (bulkColor) updates.color = bulkColor;
    if (bulkStatus) updates.status = bulkStatus;
    if (!Object.keys(updates).length) return;

    setIsBulkWorking(true);
    try {
      await userPointsApi.bulkUpdatePoints(selectedIds, updates);
      const selectedSet = new Set(selectedIds);
      queryClient.setQueryData(['userPointsAll'], (prev: unknown) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.map((p: unknown) => {
          const item = (p ?? {}) as Record<string, unknown>;
          return selectedSet.has(Number(item.id)) ? { ...item, ...updates } : item;
        });
      });
      setShowBulkEdit(false);
      setBulkColor(null);
      setBulkStatus(null);
      setSelectedIds([]);
      setSelectionMode(false);
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
    }
  }, [bulkColor, bulkStatus, queryClient, selectedIds]);

  const deleteSelected = useCallback(async () => {
    if (!selectedIds.length) return;
    setIsBulkWorking(true);
    setBulkProgress({ current: 0, total: selectedIds.length });
    try {
      const batchSize = 5;
      let done = 0;
      for (let i = 0; i < selectedIds.length; i += batchSize) {
        const chunk = selectedIds.slice(i, i + batchSize);
        await Promise.all(chunk.map((id) => userPointsApi.deletePoint(id)));
        done += chunk.length;
        setBulkProgress({ current: done, total: selectedIds.length });
      }
      const selectedSet = new Set(selectedIds);
      queryClient.setQueryData(['userPointsAll'], (prev: unknown) => {
        const arr = Array.isArray(prev) ? prev : [];
        return arr.filter((p: unknown) => {
          const item = (p ?? {}) as Record<string, unknown>;
          return !selectedSet.has(Number(item.id));
        });
      });
      setSelectedIds([]);
      setSelectionMode(false);
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setBulkProgress(null);
      setShowConfirmDeleteSelected(false);
    }
  }, [queryClient, selectedIds]);

  const deleteAll = useCallback(async () => {
    setIsBulkWorking(true);
    try {
      await userPointsApi.purgePoints();
      queryClient.setQueryData(['userPointsAll'], []);
      exitSelectionMode();
    } catch {
      // noop
    } finally {
      setIsBulkWorking(false);
      setBulkProgress(null);
      setShowConfirmDeleteAll(false);
    }
  }, [exitSelectionMode, queryClient]);

  return {
    selectionMode,
    selectedIds,
    selectedIdSet,
    showBulkEdit,
    setShowBulkEdit,
    bulkColor,
    setBulkColor,
    bulkStatus,
    setBulkStatus,
    isBulkWorking,
    setIsBulkWorking,
    bulkProgress,
    showConfirmDeleteSelected,
    setShowConfirmDeleteSelected,
    showConfirmDeleteAll,
    setShowConfirmDeleteAll,
    startSelectionMode,
    toggleSelect,
    clearSelection,
    exitSelectionMode,
    applyBulkEdit,
    deleteSelected,
    deleteAll,
  };
};
