// components/trips/planning/useTripRouteFileBranch.ts
// Файловая ветка маршрута поездки: чтение сохранённого файла и оригинального
// трека, отложенная отправка выбранного оригинала и его удаление. Вынесено из
// RouteBuilder.tsx (#1825) дословно — локи, тексты ошибок и порядок вызовов те
// же самые.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  usePlannedTripOriginalTrack,
  usePlannedTripRouteFile,
  useDeletePlannedTripRouteFile,
  useUploadPlannedTripRouteFile,
} from '@/hooks/usePlannedTripRouteFile';
import { releasePickedTripRouteUpload } from '@/components/trips/planning/TripRouteFilePicker';
import {
  toRouteFileUploadPart,
  type PickedTripRouteFileUpload,
} from '@/components/trips/planning/TripRouteFilePicker.types';
import { translate as i18nT } from '@/i18n'

export function useTripRouteFileBranch({
  tripId,
  isOwner,
}: {
  tripId: number;
  isOwner: boolean;
}) {
  // #1496 — фаза 2 импорта. Исходный файл хранится у поездки отдельно от точек:
  // хранилище доступно только владельцу, поэтому участник видит обычный маршрут
  // без запросов к нему.
  const routeFileQuery = usePlannedTripRouteFile(tripId, { enabled: isOwner });
  const storedRouteFile = routeFileQuery.data ?? null;
  const originalTrackQuery = usePlannedTripOriginalTrack(tripId, storedRouteFile, {
    enabled: isOwner,
  });
  const originalTrack = originalTrackQuery.data ?? null;
  const uploadRouteFile = useUploadPlannedTripRouteFile();
  const deleteRouteFile = useDeletePlannedTripRouteFile();
  // Оригинал уезжает на бэкенд тем же действием «Сохранить маршрут», что и точки:
  // иначе сохранённый файл описывал бы маршрут, которого у поездки ещё нет.
  const pendingOriginalRef = useRef<PickedTripRouteFileUpload | null>(null);
  const [pendingOriginalName, setPendingOriginalName] = useState<string | null>(null);
  const [originalUploadError, setOriginalUploadError] = useState<string | null>(null);

  // #1824, пункт 3: третья мутация файловой ветки. Черновик точек она не
  // трогает, поэтому ответом его не затирает, — но синхронного лока у неё тоже
  // не было, а `disabled` кнопки держится на `deleteRouteFile.isPending` и
  // поднимается только со следующим рендером. Повтор нажатия в одном тике слал
  // второй DELETE того же `routeId`, второй отвечал 404, и пользователь получал
  // «не удалось удалить» на файле, который на самом деле удалён.
  const routeFileDeleteLockedRef = useRef(false);

  const handleRemoveStoredRouteFile = useCallback(() => {
    if (!storedRouteFile || routeFileDeleteLockedRef.current) return;
    routeFileDeleteLockedRef.current = true;
    setOriginalUploadError(null);
    deleteRouteFile.mutate(
      { tripId, routeId: storedRouteFile.id },
      {
        onError: () => setOriginalUploadError(
          i18nT('tripsStatic:plan.routeImport.original.removeError'),
        ),
        // Как и у отправки оригинала, лок снимается и по отказу: иначе отказ
        // хранилища запирал бы кнопку до перезагрузки экрана.
        onSettled: () => {
          routeFileDeleteLockedRef.current = false;
        },
      },
    );
  }, [deleteRouteFile, storedRouteFile, tripId]);

  // Освобождаем кэш-копию, если экран закрыли, не сохранив маршрут.
  useEffect(() => () => {
    const pending = pendingOriginalRef.current;
    pendingOriginalRef.current = null;
    if (pending) void releasePickedTripRouteUpload(pending);
  }, []);

  // #1824: у файловой ветки кнопки та же дыра, что была у PUT. Ветка
  // «точки не менялись» уходит сюда мимо лока сохранения, а `disabled` кнопки
  // держится на `uploadRouteFile.isPending`, который поднимается только со
  // следующим рендером. Повтор нажатия в одном тике успевал отправить второй
  // multipart того же файла (до 20 МиБ), и завершение первой отправки удаляло
  // кэш-копию из-под второй — пользователь видел ошибку загрузки на файле,
  // который на самом деле загрузился.
  const originalUploadLockedRef = useRef(false);

  // Загрузка оригинала идёт после успешного сохранения точек и не откатывает их:
  // при отказе хранилища точки остаются сохранёнными, файл остаётся выбранным, и
  // повторное «Сохранить маршрут» пробует загрузку ещё раз.
  const uploadPendingOriginal = async (): Promise<void> => {
    const pending = pendingOriginalRef.current;
    if (!pending || originalUploadLockedRef.current) return;
    originalUploadLockedRef.current = true;
    setOriginalUploadError(null);
    try {
      await uploadRouteFile.mutateAsync({
        tripId,
        file: toRouteFileUploadPart(pending),
      });
      pendingOriginalRef.current = null;
      setPendingOriginalName(null);
      void releasePickedTripRouteUpload(pending);
    } catch {
      setOriginalUploadError(i18nT('tripsStatic:plan.routeImport.original.uploadError'));
    } finally {
      // Отказ хранилища лок не удерживает: ретрай той же кнопкой обязан
      // проходить, поэтому снятие идёт и по успеху, и по ошибке.
      originalUploadLockedRef.current = false;
    }
  };

  // Хвост `handleApplyImportedRoute`, относящийся к файлу: тот же порядок
  // вызовов, что был в контейнере, — сначала сброс ошибки, затем подмена
  // отложенного оригинала.
  const acceptImportedOriginal = useCallback((
    originalUpload: PickedTripRouteFileUpload | null,
  ) => {
    setOriginalUploadError(null);
    if (originalUpload) {
      // Предыдущий невыгруженный выбор больше не нужен — иначе на устройстве
      // остаётся кэш-копия файла до 20 МиБ.
      const previous = pendingOriginalRef.current;
      if (previous) void releasePickedTripRouteUpload(previous);
      pendingOriginalRef.current = originalUpload;
      setPendingOriginalName(
        originalUpload.kind === 'native' ? originalUpload.name : originalUpload.file.name,
      );
    }
  }, []);

  return {
    storedRouteFile,
    originalTrack,
    pendingOriginalName,
    originalUploadError,
    originalUploadPending: uploadRouteFile.isPending,
    storedFileRemoving: deleteRouteFile.isPending,
    handleRemoveStoredRouteFile,
    uploadPendingOriginal,
    acceptImportedOriginal,
  };
}
