package com.jianofreo.media.repository;

import com.jianofreo.media.entity.MediaFile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaFileRepository extends JpaRepository<MediaFile, Integer> {
}
