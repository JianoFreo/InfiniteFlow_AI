package com.jianofreo.job.repository;

import com.jianofreo.job.entity.ChunkStatus;
import com.jianofreo.job.entity.JobChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface JobChunkRepository extends JpaRepository<JobChunk, Integer> {

    List<JobChunk> findByJob_IdOrderByChunkIndexAsc(Integer jobId);

    Optional<JobChunk> findByJob_IdAndChunkIndex(Integer jobId, Integer chunkIndex);

    int countByJob_IdAndStatus(Integer jobId, ChunkStatus status);

    // Derived deletes need a transaction (simulab's DELETE /user bug), so it is declared right here.
    @Transactional
    void deleteByJob_Id(Integer jobId);
}
