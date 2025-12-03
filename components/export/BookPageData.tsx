import React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchTravel } from "@/src/api/travelsApi";
import type { Travel } from "@/src/types/types";
import BookPageView from "./BookPageView";

type BookPageDataProps = {
    id: number;
    pageNumber?: number;
};

const STALE_TIME_MS = 10 * 60_000; // 10 минут

export default function BookPageData({ id, pageNumber = 1 }: BookPageDataProps) {
    const {
        data: travel,
        isLoading,
        isError,
    } = useQuery<Travel>({
        queryKey: ["travel", id],
        queryFn: () => fetchTravel(id),
        staleTime: STALE_TIME_MS,
        placeholderData: keepPreviousData,
    });

    if (isLoading && !travel) {
        return (
            <div className="book-page">
                <div className="hero skeleton" />
                <div className="metaRow">
                    <div className="metaCol">
                        <div className="metaItem skeleton-line" />
                        <div className="metaItem skeleton-line" />
                        <div className="metaItem skeleton-line short" />
                    </div>
                    <div className="miniMap">
                        <div className="miniMapStub skeleton" />
                    </div>
                </div>
                <div className="section">
                    <div className="skeleton-paragraph" />
                </div>
            </div>
        );
    }

    if (isError || !travel) {
        return (
            <div className="book-page">
                <div style={{ padding: 16, color: "#a00" }}>
                    Не удалось загрузить путешествие #{id}
                </div>
            </div>
        );
    }

    const viewTravel = travel as unknown as React.ComponentProps<
        typeof BookPageView
    >["travel"];

    return <BookPageView travel={viewTravel} pageNumber={pageNumber} />;
}
