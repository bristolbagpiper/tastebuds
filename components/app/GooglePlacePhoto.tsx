'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react'

type GooglePlacePhotoResponse = {
  photo?: {
    authorName: string | null
    photoUri: string | null
  }
}

export function GooglePlacePhoto({
  alt,
  attributionClassName,
  fallbackSrc,
  imageClassName,
  placeId,
}: {
  alt: string
  attributionClassName?: string
  fallbackSrc: string
  imageClassName: string
  placeId?: string | null
}) {
  const [photoState, setPhotoState] = useState<{
    authorName: string | null
    photoUri: string | null
    placeId: string | null
  }>({
    authorName: null,
    photoUri: null,
    placeId: null,
  })
  const normalizedPlaceId = placeId?.trim() || null

  useEffect(() => {
    let active = true

    if (!normalizedPlaceId) {
      return
    }

    const currentPlaceId = normalizedPlaceId

    async function loadPhoto() {
      try {
        const response = await fetch(`/api/restaurant-photo/${encodeURIComponent(currentPlaceId)}`)
        const payload = (await response.json()) as GooglePlacePhotoResponse & {
          error?: string
        }

        if (!active || !response.ok || payload.error) {
          return
        }

        setPhotoState({
          authorName: payload.photo?.authorName ?? null,
          photoUri: payload.photo?.photoUri ?? null,
          placeId: currentPlaceId,
        })
      } catch {
        if (!active) {
          return
        }
      }
    }

    void loadPhoto()

    return () => {
      active = false
    }
  }, [normalizedPlaceId])

  const resolvedPhotoUri =
    normalizedPlaceId && photoState.placeId === normalizedPlaceId
      ? photoState.photoUri
      : null
  const resolvedAuthorName =
    normalizedPlaceId && photoState.placeId === normalizedPlaceId
      ? photoState.authorName
      : null

  return (
    <div className="relative h-full w-full">
      <img
        alt={alt}
        className={imageClassName}
        src={resolvedPhotoUri ?? fallbackSrc}
      />
      {resolvedAuthorName && attributionClassName ? (
        <div className={attributionClassName}>Photo by {resolvedAuthorName}</div>
      ) : null}
    </div>
  )
}
