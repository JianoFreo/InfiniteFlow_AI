package com.jianofreo.job.repository;

import com.jianofreo.job.entity.Job;
import com.jianofreo.job.entity.JobStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface JobRepository extends JpaRepository<Job, Integer> {

    List<Job> findAllByOrderByIdDesc(Pageable pageable);

    List<Job> findByStatusInOrderByIdDesc(Collection<JobStatus> statuses, Pageable pageable);
}
