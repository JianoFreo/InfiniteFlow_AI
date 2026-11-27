package com.jianofreo.job.repository;

import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface JobRepository extends JpaRepository<Job, Integer> {

    long countByOwnerIdAndStatusIn(String ownerId, Collection<JobStatus> statuses);

    List<Job> findByStatusIn(Collection<JobStatus> statuses);

    List<Job> findByOwnerIdOrderByIdDesc(String ownerId, Pageable pageable);

    List<Job> findByOwnerIdAndStatusInOrderByIdDesc(String ownerId, Collection<JobStatus> statuses, Pageable pageable);

    // Usage over the rolling window: source-video milliseconds of every job that did not fail on our side.
    @Query("select coalesce(sum(j.durationMs), 0) from Job j where j.ownerId = :owner and j.createdAt > :since and j.status <> :excluded")
    long sumDurationMsByOwnerSince(@Param("owner") String owner, @Param("since") Instant since, @Param("excluded") JobStatus excluded);

    @Query("select min(j.createdAt) from Job j where j.ownerId = :owner and j.createdAt > :since and j.status <> :excluded")
    Instant oldestByOwnerSince(@Param("owner") String owner, @Param("since") Instant since, @Param("excluded") JobStatus excluded);

    @Query("select coalesce(sum(j.durationMs), 0) from Job j where j.clientKey = :key and j.ownerId like 'g:%' and j.createdAt > :since and j.status <> :excluded")
    long sumGuestDurationMsByClientSince(@Param("key") String key, @Param("since") Instant since, @Param("excluded") JobStatus excluded);

    @Query("select min(j.createdAt) from Job j where j.clientKey = :key and j.ownerId like 'g:%' and j.createdAt > :since and j.status <> :excluded")
    Instant oldestGuestByClientSince(@Param("key") String key, @Param("since") Instant since, @Param("excluded") JobStatus excluded);

    /** Guest to account: every job of the guest browser becomes the account's. Returns how many moved. */
    @Modifying
    @Transactional
    @Query("update Job j set j.ownerId = :to where j.ownerId = :from")
    int reassignOwner(@Param("from") String from, @Param("to") String to);
}
