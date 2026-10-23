package com.floyd.lottoptions.legacy.desktop.generation.engine;

/**
 * Enumeration representing the various states of a lottery ticket generation process.
 * Used for tracking generation progress and determining final outcomes.
 */
public enum GenerationStatus {
    
    /**
     * Generation process has been initiated but not yet started.
     */
    PENDING("pending", "Generation request received, waiting to start"),
    
    /**
     * Generation process is currently running.
     */
    RUNNING("running", "Generating tickets and evaluating quality"),
    
    /**
     * Generation completed successfully with tickets meeting criteria.
     */
    COMPLETED("completed", "Generation completed successfully"),
    
    /**
     * Generation stopped due to pattern criteria being met.
     */
    CRITERIA_MET("criteria_met", "Stopped - pattern or quality criteria satisfied"),
    
    /**
     * Generation stopped due to timeout or maximum attempts reached.
     */
    TIMEOUT("timeout", "Stopped - timeout or maximum attempts reached"),
    
    /**
     * Generation failed due to an error or exception.
     */
    FAILED("failed", "Generation failed due to error"),
    
    /**
     * Generation was cancelled by user request.
     */
    CANCELLED("cancelled", "Generation cancelled by user");

    private final String code;
    private final String description;

    /**
     * Constructs a GenerationStatus with code and description.
     *
     * @param code Short code for API responses
     * @param description Human-readable description
     */
    GenerationStatus(String code, String description) {
        this.code = code;
        this.description = description;
    }

    /**
     * Gets the status code for API responses.
     *
     * @return The status code
     */
    public String getCode() {
        return code;
    }

    /**
     * Gets the human-readable description.
     *
     * @return The status description
     */
    public String getDescription() {
        return description;
    }

    /**
     * Checks if this status indicates a completed generation (successful or stopped).
     *
     * @return true if generation is finished
     */
    public boolean isFinished() {
        return this == COMPLETED || this == CRITERIA_MET || this == TIMEOUT || this == FAILED || this == CANCELLED;
    }

    /**
     * Checks if this status indicates a successful generation.
     *
     * @return true if generation was successful
     */
    public boolean isSuccessful() {
        return this == COMPLETED || this == CRITERIA_MET;
    }

    /**
     * Checks if this status indicates an active generation process.
     *
     * @return true if generation is currently running
     */
    public boolean isActive() {
        return this == PENDING || this == RUNNING;
    }

    /**
     * Parses a string into a GenerationStatus, with fallback to PENDING.
     *
     * @param statusCode The status code to parse
     * @return The corresponding GenerationStatus, or PENDING if not found
     */
    public static GenerationStatus fromCode(String statusCode) {
        if (statusCode == null) {
            return PENDING;
        }
        
        for (GenerationStatus status : values()) {
            if (status.code.equalsIgnoreCase(statusCode.trim())) {
                return status;
            }
        }
        
        return PENDING;
    }

    /**
     * Gets the next logical status based on generation progress.
     *
     * @param criteriaMetType Type of criteria that was met (pattern, quality, timeout)
     * @return The appropriate next status
     */
    public static GenerationStatus getCompletionStatus(String criteriaMetType) {
        if (criteriaMetType == null) {
            return COMPLETED;
        }
        
        switch (criteriaMetType.toLowerCase()) {
            case "pattern":
            case "quality":
                return CRITERIA_MET;
            case "timeout":
            case "attempts":
                return TIMEOUT;
            case "error":
                return FAILED;
            case "cancelled":
                return CANCELLED;
            default:
                return COMPLETED;
        }
    }

    @Override
    public String toString() {
        return code;
    }
}