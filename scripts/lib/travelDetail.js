'use strict';

/** Fetch a single travel detail (description + gallery). */
function extractTravelDetailAuthorFields(detail) {
  const authorFields = {};

  if (detail && typeof detail.user === 'object' && detail.user) {
    authorFields.user = detail.user;
  }

  if (typeof detail?.userName === 'string' && detail.userName.trim()) {
    authorFields.userName = detail.userName;
  }

  if (typeof detail?.author_name === 'string' && detail.author_name.trim()) {
    authorFields.author_name = detail.author_name;
  }

  if (typeof detail?.authorName === 'string' && detail.authorName.trim()) {
    authorFields.authorName = detail.authorName;
  }

  if (typeof detail?.owner_name === 'string' && detail.owner_name.trim()) {
    authorFields.owner_name = detail.owner_name;
  }

  if (typeof detail?.ownerName === 'string' && detail.ownerName.trim()) {
    authorFields.ownerName = detail.ownerName;
  }

  if (typeof detail?.userId !== 'undefined' && detail.userId !== null && detail.userId !== '') {
    authorFields.userId = detail.userId;
  }

  if (typeof detail?.user_id !== 'undefined' && detail.user_id !== null && detail.user_id !== '') {
    authorFields.user_id = detail.user_id;
  }

  const rawUserIds = typeof detail?.userIds !== 'undefined' ? detail.userIds : detail?.user_ids;
  if (typeof rawUserIds !== 'undefined' && rawUserIds !== null && rawUserIds !== '') {
    authorFields.userIds = rawUserIds;
  }

  if (typeof detail?.userTravelsCount !== 'undefined' && detail.userTravelsCount !== null) {
    authorFields.userTravelsCount = detail.userTravelsCount;
  }

  return authorFields;
}

function extractTravelDetailContentFields(detail) {
  const contentFields = {};

  if (typeof detail?.youtube_link === 'string') {
    contentFields.youtube_link = detail.youtube_link;
  }

  if (typeof detail?.recommendation === 'string') {
    contentFields.recommendation = detail.recommendation;
  }

  if (typeof detail?.plus === 'string') {
    contentFields.plus = detail.plus;
  }

  if (typeof detail?.minus === 'string') {
    contentFields.minus = detail.minus;
  }

  if (typeof detail?.rating !== 'undefined' && detail.rating !== null) {
    contentFields.rating = detail.rating;
  }

  if (typeof detail?.rating_count !== 'undefined' && detail.rating_count !== null) {
    contentFields.rating_count = detail.rating_count;
  }

  if (typeof detail?.user_rating !== 'undefined' && detail.user_rating !== null) {
    contentFields.user_rating = detail.user_rating;
  }

  if (typeof detail?.number_days !== 'undefined' && detail.number_days !== null) {
    contentFields.number_days = detail.number_days;
  }

  if (typeof detail?.monthName === 'string') {
    contentFields.monthName = detail.monthName;
  }

  if (typeof detail?.year !== 'undefined' && detail.year !== null && detail.year !== '') {
    contentFields.year = detail.year;
  }

  return contentFields;
}

function normalizeTravelDetail(detail) {
  // A 200 carrying something that is not a travel object would spread into an
  // all-empty page and pass every downstream check — the same silent
  // degradation #1394 is about, just arriving over a healthy connection.
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) {
    throw new Error(`unexpected detail payload: ${Object.prototype.toString.call(detail)}`);
  }
  return {
    description: detail.description || '',
    ...(typeof detail.meta_description === 'string' || detail.meta_description === null
      ? { meta_description: detail.meta_description }
      : {}),
    // #1116: media-манифест обязателен здесь — из него hero preload берёт тот же
    // вариант, что запросит клиент. Без него preload уходил в клиентскую сборку
    // (`?v=…&q=82`), расходился с LCP-`<img>` и грел лишний файл.
    media: detail.media || null,
    gallery: Array.isArray(detail.gallery) ? detail.gallery : [],
    travelAddress: Array.isArray(detail.travelAddress) ? detail.travelAddress : [],
    coordsMeTravel: Array.isArray(detail.coordsMeTravel) ? detail.coordsMeTravel : [],
    countryCode: detail.countryCode || '',
    ...extractTravelDetailAuthorFields(detail),
    ...extractTravelDetailContentFields(detail),
  };
}

module.exports = { extractTravelDetailAuthorFields, extractTravelDetailContentFields, normalizeTravelDetail };
