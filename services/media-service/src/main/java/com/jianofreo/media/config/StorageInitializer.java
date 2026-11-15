package com.jianofreo.media.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;

/** Creates the storage folders on boot (the multipart temp folder must exist before the first upload). */
@Slf4j
@Component
@RequiredArgsConstructor
public class StorageInitializer implements ApplicationRunner {

    private final StorageProperties storage;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        for (Path dir : new Path[]{storage.uploadsDir(), storage.outputsDir(),
                storage.rootPath().resolve("jobs"), storage.rootPath().resolve("tmp")}) {
            Files.createDirectories(dir);
        }
        log.info("storage_ready root={}", storage.rootPath());
    }
}
