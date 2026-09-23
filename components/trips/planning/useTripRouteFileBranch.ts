// components/trips/planning/useTripRouteFileBranch.ts
// Файловая ветка маршрута поездки: чтение сохранённых файлов и их оригинальных
// треков, отложенная отправка выбранного оригинала и удаление любого из файлов.
// Вынесено из RouteBuilder.tsx (#1825) дословно — локи, тексты ошибок и порядок
// вызовов те же самые; с #2069 ветка работает со списком файлов, а не с одним.
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PLANNED_TRIP_ROUTE_FILES_MAX,
  type PlannedTripRouteFile,
} from '@/api/plannedTripRoutes';
import {
  usePlannedTripOriginalTracks,
  usePlannedTripRouteFiles,
  useDeletePlannedTripRouteFile,
  useUploadPlannedTripRouteFile,
} from '@/hooks/usePlannedTripRouteFile';
import { releasePickedTripRouteUpload } from '@/components/trips/planning/TripRouteFilePicker';
import {
  toRouteFileUploadPart,
  type PickedTripRouteFileUpload,
} from '@/components/trips/planning/TripRouteFilePicker.types';
import { translate as i18nT } from '@/i18n'
import { formatInteger } from '@/i18n/format'

const NO_FILES: PlannedTripRouteFile[] = [];

export function useTripRouteFileBranch({
  tripId,
  isOwner,
}: {
  tripId: number;
  isOwner: boolean;
}) {
  // #1496 — фаза 2 импорта. Исходные файлы хранятся у поездки отдельно от точек:
  // хранилище доступно только владельцу, поэтому участник видит обычный маршрут
  // без запросов к нему. Файлов ноль или несколько (#2069), и на карту идут линии
  // всех — новый файл добавляется к прежним, а не прячется за первым.
  const routeFilesQuery = usePlannedTripRouteFiles(tripId, { enabled: isOwner });
  const storedRouteFiles = routeFilesQuery.data ?? NO_FILES;
  const originalTrackSegments = usePlannedTripOriginalTracks(tripId, storedRouteFiles, {
    enabled: isOwner,
  });
  const uploadRouteFile = useUploadPlannedTripRouteFile();
  const deleteRouteFile = useDeletePlannedTripRouteFile();
  // Какой именно файл сейчас удаляется: «занята» только его кнопка, остальные
  // «Удалить» выключены, пока идёт этот DELETE (лок ниже всё равно один).
  const removingRouteFileId = deleteRouteFile.isPending
    ? Number(deleteRouteFile.variables?.routeId)
    : null;
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

  // Удаляется ровно тот файл, чьё «Удалить» подтвердили (#2054). Файла уже нет в
  // списке — удалять нечего, и DELETE не уходит.
  const handleRemoveStoredRouteFile = useCallback((routeId: number) => {
    if (routeFileDeleteLockedRef.current) return;
    if (!storedRouteFiles.some((file) => file.id === routeId)) return;
    routeFileDeleteLockedRef.current = true;
    setOriginalUploadError(null);
    deleteRouteFile.mutate(
      { tripId, routeId },
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
  }, [deleteRouteFile, storedRouteFiles, tripId]);

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
    // На лимите бэкенд всё равно ответит 400, а общий текст «нажмите ещё раз»
    // обещал бы ретрай, который не пройдёт никогда. Файл остаётся выбранным:
    // после удаления лишнего трека то же «Сохранить маршрут» его догрузит.
    if (storedRouteFiles.length >= PLANNED_TRIP_ROUTE_FILES_MAX) {
      setOriginalUploadError(i18nT('tripsStatic:plan.routeImport.original.limitError', {
        value: formatInteger(PLANNED_TRIP_ROUTE_FILES_MAX),
      }));
      return;
    }
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
    storedRouteFiles,
    originalTrackSegments,
    pendingOriginalName,
    originalUploadError,
    originalUploadPending: uploadRouteFile.isPending,
    removingRouteFileId,
    handleRemoveStoredRouteFile,
    uploadPendingOriginal,
    acceptImportedOriginal,
  };
}
