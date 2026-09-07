// components/trips/planning/useRoutePointDraft.ts
// Черновик точки маршрута: состояние формы добавления, состояние формы правки и
// все переходы между ними. Вынесено из RouteBuilder.tsx (#1825) дословно —
// ref'ы автоподстановки, зеркало имени и порядок вызовов setState те же самые.
import React, { useCallback, useRef, useState } from 'react';

import { type RoutePoint, type RoutePointType } from '@/api/plannedTrips';
import {
  addressPointName,
  coordinatesFromFields,
  formatCoordinateInput,
} from '@/components/trips/planning/routeBuilderPoint';
import { trackRoutePointAdded } from '@/utils/tripAnalytics';
import { translate as i18nT } from '@/i18n'

export function useRoutePointDraft({
  tripId,
  setRoute,
}: {
  tripId: number;
  setRoute: React.Dispatch<React.SetStateAction<RoutePoint[]>>;
}) {
  const [newType, setNewType] = useState<RoutePointType>('place');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPointError, setNewPointError] = useState<string | null>(null);
  const [isAddPointOpen, setIsAddPointOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editType, setEditType] = useState<RoutePointType>('custom');
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  // #1782: повторный выбор адреса обязан переписать то, что подставил сам поиск,
  // и не тронуть то, что набрал пользователь. Ref держит последнее записанное
  // поиском значение: поле, равное ему, принадлежит поиску, `null` — правке
  // пользователя. Иначе исправленная «Острава → Прага» уезжала бы в маршрут с
  // пражскими координатами под именем и описанием Остравы.
  const addAddressAutofillRef = useRef<{ name: string | null; description: string | null }>({
    name: '',
    description: '',
  });
  const editAddressAutofillNameRef = useRef<string | null>('');
  // Зеркало `editName` для `handleEditAddressSelect`: сравнивать надо до записи
  // ref'а автоподстановки, а зависимость от самого состояния пересоздавала бы
  // колбэк на каждый символ и снимала `React.memo` с `AddressSearch` формы.
  const editNameRef = useRef('');

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    const { coordinates, error } = coordinatesFromFields(newLat, newLng);
    if (error) {
      setNewPointError(error);
      return;
    }
    const description = newDescription.trim();

    setNewPointError(null);
    setRoute((prev) => [
      ...prev,
      {
        id: `local-${prev.length}-${name}`,
        type: newType,
        name,
        description: description || null,
        coordinates,
        placeId: null,
      },
    ]);
    trackRoutePointAdded(tripId, newType);
    setNewName('');
    setNewLat('');
    setNewLng('');
    setNewDescription('');
    addAddressAutofillRef.current = { name: '', description: '' };
    setIsAddPointOpen(false);
  };

  const handleStartEdit = useCallback((point: RoutePoint, index: number) => {
    setIsAddPointOpen(false);
    setEditingIndex(index);
    setEditType(point.type);
    setEditName(point.name);
    editNameRef.current = point.name;
    setEditDescription(point.description ?? '');
    setEditLat(point.coordinates ? formatCoordinateInput(point.coordinates[1]) : '');
    setEditLng(point.coordinates ? formatCoordinateInput(point.coordinates[0]) : '');
    setEditError(null);
    editAddressAutofillNameRef.current = '';
  }, []);

  // Ссылка обязана быть стабильной: она уезжает в `onCloseEdit` каждой строки
  // точки, а `RoutePointRow` мемоизирован — с новой функцией на каждый рендер
  // любой символ в инлайн-редакторе перерисовывал бы весь список.
  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditError(null);
    editAddressAutofillNameRef.current = '';
  }, []);

  // Единственная точка записи имени правки: состояние и его зеркало не должны
  // разъезжаться.
  const commitEditName = useCallback((next: string) => {
    editNameRef.current = next;
    setEditName(next);
  }, []);

  const handleOpenAddPoint = () => {
    setEditingIndex(null);
    setEditError(null);
    setNewPointError(null);
    addAddressAutofillRef.current = { name: '', description: '' };
    setIsAddPointOpen(true);
  };

  const handleCancelAddPoint = () => {
    setIsAddPointOpen(false);
    setNewPointError(null);
    addAddressAutofillRef.current = { name: '', description: '' };
  };

  // Применение открытой правки к маршруту. Вынесено из `handleSaveEdit`, потому что
  // тот же коммит нужен тапу по карте: иначе незакрытый редактор либо блокирует
  // добавление точек, либо молча теряет введённое имя.
  const applyPointEdit = (prev: RoutePoint[], index: number): RoutePoint[] => {
    const name = editName.trim();
    if (!name) return prev;
    const { coordinates, error } = coordinatesFromFields(editLat, editLng);
    if (error || !coordinates) return prev;
    const current = prev[index];
    if (!current) return prev;
    const next = prev.slice();
    const nextType = editType === 'place' && current.placeId == null ? 'custom' : editType;
    next[index] = {
      ...current,
      type: nextType,
      name,
      description: editDescription.trim() || null,
      coordinates,
      placeId: nextType === 'place' ? current.placeId : null,
    };
    return next;
  };

  const handleSaveEdit = () => {
    if (editingIndex == null) return;
    const name = editName.trim();
    if (!name) {
      setEditError(i18nT('trips:components.trips.planning.RouteBuilder.vvedite_nazvanie_tochki_65a2f141'));
      return;
    }

    const { coordinates, error } = coordinatesFromFields(editLat, editLng);
    if (error) {
      setEditError(error);
      return;
    }

    setRoute((prev) => {
      const current = prev[editingIndex];
      if (!current) return prev;
      const next = prev.slice();
      // #1532: `place` — не самостоятельный ярлык, а следствие привязки к месту
      // или путешествию MeTravel. Точка без `placeId` этот тип получить не
      // может: маршрут ушёл бы как `point_type: 'travel', place_id: null`, а
      // бэкенд (`validate_route_point_attrs`) отклоняет такой PUT целиком —
      // вместе со всеми здоровыми точками маршрута.
      const nextType = editType === 'place' && current.placeId == null ? 'custom' : editType;
      next[editingIndex] = {
        ...current,
        type: nextType,
        name,
        description: editDescription.trim() || null,
        coordinates,
        placeId: nextType === 'place' ? current.placeId : null,
      };
      return next;
    });
    setEditingIndex(null);
    setEditError(null);
  };

  const handleAddPointFromMap = ({ lat, lng }: { lat: number; lng: number }) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setIsAddPointOpen(false);
    // Точка, добавленная с карты, сразу открывает редактор (так задумано подсказкой
    // «после клика можно сразу переименовать»). Раньше это же и убивало карту: пока
    // редактор открыт, обработчик тапа не передавался вовсе, и следующий тап молча
    // ничего не делал — при живой подсказке «нажмите на карту, чтобы добавить точку».
    // Теперь незакрытая правка фиксируется, и цепочка тапов работает подряд.
    const pendingIndex = editingIndex;
    setRoute((prev) => {
      const base = pendingIndex == null ? prev : applyPointEdit(prev, pendingIndex);
      const nextIndex = base.length;
      const name = i18nT('trips:components.trips.planning.RouteBuilder.tochka_value1_58a44f4e', { value1: nextIndex + 1 });
      const point: RoutePoint = {
        id: `map-${Date.now()}-${nextIndex}`,
        type: 'custom',
        name,
        description: null,
        coordinates: [lng, lat],
        placeId: null,
      };
      setEditingIndex(nextIndex);
      setEditType(point.type);
      setEditName(point.name);
      editNameRef.current = point.name;
      setEditDescription('');
      setEditLat(formatCoordinateInput(lat));
      setEditLng(formatCoordinateInput(lng));
      setEditError(null);
      // Тап по карте — такой же вход в правку новой точки, как `handleStartEdit`:
      // без сброса имя, подставленное поиском предыдущей точке, считалось бы
      // «своим» и молча переписалось бы следующим выбором адреса.
      editAddressAutofillNameRef.current = '';
      return [...base, point];
    });
    trackRoutePointAdded(tripId, 'custom');
  };

  // #1782: выбранный адрес заполняет форму, чтобы название можно было уточнить
  // до добавления. Саму точку создаёт общий handleAdd после подтверждения.
  const handleAddAddressSelect = useCallback(
    (address: string, coords: { lat: number; lng: number }) => {
      const full = address.trim();
      if (!full || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
      // #1532: `place` без `placeId` бэкенд отклоняет вместе со всем маршрутом,
      // а адресная точка привязки к месту MeTravel не имеет.
      const isSiteMode = newType === 'place';
      const type: RoutePointType = isSiteMode ? 'custom' : newType;
      // В режиме «Место» форма показывает только поиск по MeTravel
      // (`RoutePointAddForm`), полей названия и описания на экране нет. Их
      // прежнее значение — невидимый остаток прошлой попытки, а не ввод
      // пользователя, поэтому имя тогда берётся из адреса.
      // Значение, оставшееся от прошлого выбора адреса, вводом пользователя не
      // считается: иначе второй выбор менял бы только координаты.
      const autofilled = addAddressAutofillRef.current;
      const currentName = isSiteMode ? '' : newName.trim();
      const currentDescription = isSiteMode ? '' : newDescription.trim();
      const nameOwnedBySearch = !currentName || currentName === autofilled.name;
      const descriptionOwnedBySearch =
        !currentDescription || currentDescription === autofilled.description;
      const name = nameOwnedBySearch ? addressPointName(full) : currentName;
      const description = descriptionOwnedBySearch
        ? full === name
          ? ''
          : full
        : currentDescription;

      setNewType(type);
      setNewName(name);
      setNewLat(formatCoordinateInput(coords.lat));
      setNewLng(formatCoordinateInput(coords.lng));
      setNewDescription(description);
      setNewPointError(null);
      addAddressAutofillRef.current = {
        name: nameOwnedBySearch ? name : null,
        description: descriptionOwnedBySearch ? description : null,
      };
    },
    [newDescription, newName, newType],
  );

  // #1782: правку точки тоже нельзя было довести без точных координат —
  // тестировщик видел только два числовых поля. Тот же `AddressSearch`, что и в
  // добавлении, подставляет сюда координаты; ручной ввод остаётся рабочим.
  const handleEditAddressSelect = useCallback(
    (address: string, coords: { lat: number; lng: number }) => {
      if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return;
      setEditLat(formatCoordinateInput(coords.lat));
      setEditLng(formatCoordinateInput(coords.lng));
      // Имя принадлежит пользователю: «Ночёвка у Пети» не должна превратиться в
      // адрес из-за уточнения координат. Поиск заполняет его только пустым — или
      // своим же прошлым результатом, чтобы исправленный выбор не оставил имя
      // первого места при координатах второго.
      const currentName = editNameRef.current.trim();
      const nameOwnedBySearch = !currentName || currentName === editAddressAutofillNameRef.current;
      const autoName = addressPointName(address);
      if (nameOwnedBySearch) commitEditName(autoName);
      editAddressAutofillNameRef.current = nameOwnedBySearch ? autoName : null;
      setEditError(null);
    },
    [commitEditName],
  );

  return {
    newType,
    newName,
    newLat,
    newLng,
    newDescription,
    newPointError,
    isAddPointOpen,
    editingIndex,
    editType,
    editName,
    editLat,
    editLng,
    editDescription,
    editError,
    setNewType,
    setNewName,
    setNewLat,
    setNewLng,
    setNewDescription,
    setNewPointError,
    setIsAddPointOpen,
    setEditingIndex,
    setEditType,
    setEditLat,
    setEditLng,
    setEditDescription,
    setEditError,
    handleAdd,
    handleStartEdit,
    handleCancelEdit,
    commitEditName,
    handleOpenAddPoint,
    handleCancelAddPoint,
    handleSaveEdit,
    handleAddPointFromMap,
    handleAddAddressSelect,
    handleEditAddressSelect,
  };
}
