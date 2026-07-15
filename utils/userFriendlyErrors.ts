import { translate as i18nT } from '@/i18n'
// src/utils/userFriendlyErrors.ts
// ✅ Утилита для преобразования технических ошибок в понятные сообщения для пользователей

/**
 * Преобразует техническую ошибку в понятное сообщение для пользователя
 */
export function getUserFriendlyError(error: Error | string | unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error || i18nT('errorsStatic:utils.userFriendlyErrors.unknownInput'));

    // Сетевые ошибки
    if (/network|fetch|connection|timeout/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.problema_s_podklyucheniem_k_internetu_prover_2d6c3825');
    }

    if (/timeout|превышено время/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.prevysheno_vremya_ozhidaniya_server_ne_otvec_12fc2b3e');
    }

    // Ошибки авторизации
    if (/401|unauthorized|не авторизован/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.trebuetsya_avtorizatsiya_pozhaluysta_voydite_6b5f5a26');
    }

    if (/403|forbidden|доступ запрещен/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.dostup_zapreschen_u_vas_net_prav_dlya_vypoln_2dc3ee6b');
    }

    // Ошибки валидации
    if (/400|validation|invalid|некорректн/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.nekorrektnye_dannye_proverte_vvedennuyu_info_30990282');
    }

    // Ошибки сервера
    if (/500|502|503|504|server error|ошибка сервера/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.oshibka_na_servere_my_uzhe_rabotaem_nad_ispr_82895fbc');
    }

    // Ошибки загрузки файлов
    if (/file|upload|загрузк/i.test(errorMessage)) {
        if (/size|размер/i.test(errorMessage)) {
            return i18nT('errors:utils.userFriendlyErrors.fayl_slishkom_bolshoy_vyberite_fayl_menshego_7158a659');
        }
        if (/format|формат|type/i.test(errorMessage)) {
            return i18nT('errors:utils.userFriendlyErrors.nepodderzhivaemyy_format_fayla_vyberite_drug_5d426178');
        }
        return i18nT('errors:utils.userFriendlyErrors.oshibka_pri_zagruzke_fayla_poprobuyte_esche__5972a304');
    }

    // Ошибки парсинга
    if (/json|parse|парсинг/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.oshibka_pri_obrabotke_dannyh_poprobuyte_obno_632d0c4c');
    }

    // Специфичные ошибки приложения
    if (/не найдено|not found|404/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.zaprashivaemyy_resurs_ne_nayden_ce540ffd');
    }

    if (/email|почт/i.test(errorMessage) && /invalid|некорректн/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.nekorrektnyy_email_adres_proverte_pravilnost_b694bdcf');
    }

    if (/password|пароль/i.test(errorMessage)) {
        if (/weak|слаб/i.test(errorMessage)) {
            return i18nT('errors:utils.userFriendlyErrors.parol_slishkom_slabyy_ispolzuyte_bolee_slozh_e4f78011');
        }
        if (/match|совпад/i.test(errorMessage)) {
            return i18nT('errors:utils.userFriendlyErrors.paroli_ne_sovpadayut_proverte_vvedennye_paro_b5d936ca');
        }
        return i18nT('errors:utils.userFriendlyErrors.oshibka_s_parolem_proverte_pravilnost_vvoda_787e5475');
    }

    // Если сообщение уже понятное для пользователя, возвращаем его
    if (errorMessage.length < 100 && !/Error|Exception|at |stack/i.test(errorMessage)) {
        return errorMessage;
    }

    // Общее сообщение для неизвестных ошибок
    return i18nT('errors:utils.userFriendlyErrors.proizoshla_oshibka_poprobuyte_esche_raz_ili__2a263152');
}

/**
 * Получает заголовок ошибки для отображения
 */
export function getErrorTitle(error: Error | string | unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error || '');

    if (/network|connection|timeout/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.problema_s_podklyucheniem_937d57e4');
    }

    if (/401|unauthorized/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.trebuetsya_avtorizatsiya_abc374d7');
    }

    if (/403|forbidden/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.dostup_zapreschen_e6e1bf46');
    }

    if (/500|server error/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.oshibka_servera_0fe528a6');
    }

    if (/validation|invalid/i.test(errorMessage)) {
        return i18nT('errors:utils.userFriendlyErrors.oshibka_validatsii_2ec22c36');
    }

    return i18nT('errors:utils.userFriendlyErrors.oshibka_9514eda7');
}

/**
 * Проверяет, является ли ошибка критической (требует перезагрузки)
 */
export function isCriticalError(error: Error | string | unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error || '');
    
    return /500|502|503|504|server error|ошибка сервера/i.test(errorMessage);
}
