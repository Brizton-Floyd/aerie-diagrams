package com.floyd.lottoptions.legacy.desktop.generation.engine;

import com.floyd.lottoptions.legacy.desktop.quality.QualityMetrics;
import com.floyd.lottoptions.legacy.desktop.generation.advanced.DroughtInformationService;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateMatrixAnalysisResult;
import com.floyd.lottoptions.legacy.desktop.shared.template.TemplateCorrelatedTicket;
import com.floyd.lottoptions.legacy.desktop.generation.delta.DeltaAnalysisResult;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Result model containing generated lottery tickets along with comprehensive analysis and session metadata.
 * This is the primary output of the MasterGenerationEngine and contains all information needed
 * for UI display and further processing.
 */
public class GeneratedTicketSet {

    private final String sessionId;
    private final Integer ticketSetId;
    private final List<int[]> tickets;
    private final QualityMetrics qualityMetrics;
    private final GenerationSummary generationSummary;
    private final String lotteryConfigId;
    private final LocalDateTime generatedAt;
    private final GenerationStatus finalStatus;
    private final HistoricalPerformanceAnalysis historicalPerformance;
    private final DroughtInformationService.DroughtInformation droughtInformation;
    private final TemplateMatrixAnalysisResult templateMatrixAnalysis;
    private final List<TemplateCorrelatedTicket> templateCorrelatedTickets;
    private final DeltaAnalysisResult deltaAnalysis;

    /**
     * Constructs a GeneratedTicketSet with all required parameters.
     *
     * @param sessionId Unique session identifier for tracking
     * @param ticketSetId The database ID of the generated ticket set
     * @param tickets List of generated lottery tickets
     * @param qualityMetrics Comprehensive quality analysis of the tickets
     * @param generationSummary Summary of the generation process
     * @param lotteryConfigId The lottery game identifier
     * @param generatedAt Timestamp when generation completed
     * @param finalStatus Final status of the generation process
     * @param historicalPerformance Historical performance analysis of the tickets
     */
    public GeneratedTicketSet(String sessionId, Integer ticketSetId, List<int[]> tickets, QualityMetrics qualityMetrics,
                             GenerationSummary generationSummary, String lotteryConfigId,
                             LocalDateTime generatedAt, GenerationStatus finalStatus,
                             HistoricalPerformanceAnalysis historicalPerformance) {
        this.sessionId = sessionId;
        this.ticketSetId = ticketSetId;
        this.tickets = tickets;
        this.qualityMetrics = qualityMetrics;
        this.generationSummary = generationSummary;
        this.lotteryConfigId = lotteryConfigId;
        this.generatedAt = generatedAt;
        this.finalStatus = finalStatus;
        this.historicalPerformance = historicalPerformance;
        this.droughtInformation = null; // For backward compatibility
        this.templateMatrixAnalysis = null; // For backward compatibility
        this.templateCorrelatedTickets = null; // For backward compatibility
        this.deltaAnalysis = null; // For backward compatibility
    }
    
    /**
     * Enhanced constructor that includes drought information for Phase 3 integration.
     *
     * @param sessionId Unique session identifier for tracking
     * @param tickets List of generated lottery tickets
     * @param qualityMetrics Comprehensive quality analysis of the tickets
     * @param generationSummary Summary of the generation process
     * @param lotteryConfigId The lottery game identifier
     * @param generatedAt Timestamp when generation completed
     * @param finalStatus Final status of the generation process
     * @param historicalPerformance Historical performance analysis of the tickets
     * @param droughtInformation Drought analysis and strategic recommendations
     */
    public GeneratedTicketSet(String sessionId, Integer ticketSetId, List<int[]> tickets, QualityMetrics qualityMetrics,
                             GenerationSummary generationSummary, String lotteryConfigId,
                             LocalDateTime generatedAt, GenerationStatus finalStatus,
                             HistoricalPerformanceAnalysis historicalPerformance,
                             DroughtInformationService.DroughtInformation droughtInformation) {
        this.sessionId = sessionId;
        this.ticketSetId = ticketSetId;
        this.tickets = tickets;
        this.qualityMetrics = qualityMetrics;
        this.generationSummary = generationSummary;
        this.lotteryConfigId = lotteryConfigId;
        this.generatedAt = generatedAt;
        this.finalStatus = finalStatus;
        this.historicalPerformance = historicalPerformance;
        this.droughtInformation = droughtInformation;
        this.templateMatrixAnalysis = null; // For backward compatibility
        this.templateCorrelatedTickets = null; // For backward compatibility
        this.deltaAnalysis = null; // For backward compatibility
    }
    
    /**
     * Enhanced constructor that includes TemplateMatrix analysis for enhanced generation.
     *
     * @param sessionId Unique session identifier for tracking
     * @param tickets List of generated lottery tickets
     * @param qualityMetrics Comprehensive quality analysis of the tickets
     * @param generationSummary Summary of the generation process
     * @param lotteryConfigId The lottery game identifier
     * @param generatedAt Timestamp when generation completed
     * @param finalStatus Final status of the generation process
     * @param historicalPerformance Historical performance analysis of the tickets
     * @param droughtInformation Drought analysis and strategic recommendations
     * @param templateMatrixAnalysis TemplateMatrix analysis results and recommendations
     */
    public GeneratedTicketSet(String sessionId, Integer ticketSetId, List<int[]> tickets, QualityMetrics qualityMetrics,
                             GenerationSummary generationSummary, String lotteryConfigId,
                             LocalDateTime generatedAt, GenerationStatus finalStatus,
                             HistoricalPerformanceAnalysis historicalPerformance,
                             DroughtInformationService.DroughtInformation droughtInformation,
                             TemplateMatrixAnalysisResult templateMatrixAnalysis) {
        this.sessionId = sessionId;
        this.ticketSetId = ticketSetId;
        this.tickets = tickets;
        this.qualityMetrics = qualityMetrics;
        this.generationSummary = generationSummary;
        this.lotteryConfigId = lotteryConfigId;
        this.generatedAt = generatedAt;
        this.finalStatus = finalStatus;
        this.historicalPerformance = historicalPerformance;
        this.droughtInformation = droughtInformation;
        this.templateMatrixAnalysis = templateMatrixAnalysis;
        this.templateCorrelatedTickets = null; // For backward compatibility
        this.deltaAnalysis = null; // For backward compatibility
    }
    
    /**
     * Enhanced constructor that includes TemplateMatrix analysis and correlated tickets.
     *
     * @param sessionId Unique session identifier for tracking
     * @param tickets List of generated lottery tickets
     * @param qualityMetrics Comprehensive quality analysis of the tickets
     * @param generationSummary Summary of the generation process
     * @param lotteryConfigId The lottery game identifier
     * @param generatedAt Timestamp when generation completed
     * @param finalStatus Final status of the generation process
     * @param historicalPerformance Historical performance analysis of the tickets
     * @param droughtInformation Drought analysis and strategic recommendations
     * @param templateMatrixAnalysis TemplateMatrix analysis results and recommendations
     * @param templateCorrelatedTickets List of tickets with their template correlations
     */
    public GeneratedTicketSet(String sessionId, Integer ticketSetId, List<int[]> tickets, QualityMetrics qualityMetrics,
                             GenerationSummary generationSummary, String lotteryConfigId,
                             LocalDateTime generatedAt, GenerationStatus finalStatus,
                             HistoricalPerformanceAnalysis historicalPerformance,
                             DroughtInformationService.DroughtInformation droughtInformation,
                             TemplateMatrixAnalysisResult templateMatrixAnalysis,
                             List<TemplateCorrelatedTicket> templateCorrelatedTickets) {
        this.sessionId = sessionId;
        this.ticketSetId = ticketSetId;
        this.tickets = tickets;
        this.qualityMetrics = qualityMetrics;
        this.generationSummary = generationSummary;
        this.lotteryConfigId = lotteryConfigId;
        this.generatedAt = generatedAt;
        this.finalStatus = finalStatus;
        this.historicalPerformance = historicalPerformance;
        this.droughtInformation = droughtInformation;
        this.templateMatrixAnalysis = templateMatrixAnalysis;
        this.templateCorrelatedTickets = templateCorrelatedTickets;
        this.deltaAnalysis = null; // For backward compatibility
    }
    
    /**
     * Enhanced constructor that includes Delta analysis results for strategic delta generation.
     *
     * @param sessionId Unique session identifier for tracking
     * @param tickets List of generated lottery tickets
     * @param qualityMetrics Comprehensive quality analysis of the tickets
     * @param generationSummary Summary of the generation process
     * @param lotteryConfigId The lottery game identifier
     * @param generatedAt Timestamp when generation completed
     * @param finalStatus Final status of the generation process
     * @param historicalPerformance Historical performance analysis of the tickets
     * @param droughtInformation Drought analysis and strategic recommendations
     * @param templateMatrixAnalysis TemplateMatrix analysis results and recommendations
     * @param templateCorrelatedTickets List of tickets with their template correlations
     * @param deltaAnalysis Delta-specific analysis results and strategic intelligence insights
     */
    public GeneratedTicketSet(String sessionId, Integer ticketSetId, List<int[]> tickets, QualityMetrics qualityMetrics,
                             GenerationSummary generationSummary, String lotteryConfigId,
                             LocalDateTime generatedAt, GenerationStatus finalStatus,
                             HistoricalPerformanceAnalysis historicalPerformance,
                             DroughtInformationService.DroughtInformation droughtInformation,
                             TemplateMatrixAnalysisResult templateMatrixAnalysis,
                             List<TemplateCorrelatedTicket> templateCorrelatedTickets,
                             DeltaAnalysisResult deltaAnalysis) {
        this.sessionId = sessionId;
        this.ticketSetId = ticketSetId;
        this.tickets = tickets;
        this.qualityMetrics = qualityMetrics;
        this.generationSummary = generationSummary;
        this.lotteryConfigId = lotteryConfigId;
        this.generatedAt = generatedAt;
        this.finalStatus = finalStatus;
        this.historicalPerformance = historicalPerformance;
        this.droughtInformation = droughtInformation;
        this.templateMatrixAnalysis = templateMatrixAnalysis;
        this.templateCorrelatedTickets = templateCorrelatedTickets;
        this.deltaAnalysis = deltaAnalysis;
    }

    /**
     * Gets the unique session identifier.
     *
     * @return The session ID
     */
    public String getSessionId() {
        return sessionId;
    }

    public Integer getTicketSetId() {
        return ticketSetId;
    }

    /**
     * Gets the generated lottery tickets.
     *
     * @return List of tickets, where each ticket is an int array of numbers
     */
    public List<int[]> getTickets() {
        return tickets;
    }

    /**
     * Gets the quality metrics for the generated tickets.
     *
     * @return Comprehensive quality analysis
     */
    public QualityMetrics getQualityMetrics() {
        return qualityMetrics;
    }

    /**
     * Gets the generation process summary.
     *
     * @return Summary containing attempts, timing, and stopping reason
     */
    public GenerationSummary getGenerationSummary() {
        return generationSummary;
    }

    /**
     * Gets the lottery configuration identifier.
     *
     * @return The lottery game ID
     */
    public String getLotteryConfigId() {
        return lotteryConfigId;
    }

    /**
     * Gets the timestamp when generation completed.
     *
     * @return Generation completion time
     */
    public LocalDateTime getGeneratedAt() {
        return generatedAt;
    }

    /**
     * Gets the final status of the generation process.
     *
     * @return The completion status
     */
    public GenerationStatus getFinalStatus() {
        return finalStatus;
    }

    /**
     * Gets the historical performance analysis of the tickets.
     *
     * @return Historical performance analysis, or null if not available
     */
    public HistoricalPerformanceAnalysis getHistoricalPerformance() {
        return historicalPerformance;
    }
    
    /**
     * Gets the drought analysis information for UI display.
     *
     * @return Drought information including tier status, recommendations, and strategic insights
     */
    public DroughtInformationService.DroughtInformation getDroughtInformation() {
        return droughtInformation;
    }
    
    /**
     * Gets the TemplateMatrix analysis information for UI display.
     *
     * @return TemplateMatrix analysis including template performance, probabilities, and recommendations
     */
    public TemplateMatrixAnalysisResult getTemplateMatrixAnalysis() {
        return templateMatrixAnalysis;
    }
    
    /**
     * Gets the template correlated tickets showing which template generated each ticket.
     *
     * @return List of tickets with their template correlation information, or null if not available
     */
    public List<TemplateCorrelatedTicket> getTemplateCorrelatedTickets() {
        return templateCorrelatedTickets;
    }
    
    /**
     * Gets the delta analysis results for tickets generated using delta strategy.
     *
     * @return Delta analysis including pattern analysis, strategic intelligence insights, and performance metrics
     */
    public DeltaAnalysisResult getDeltaAnalysis() {
        return deltaAnalysis;
    }

    /**
     * Gets the number of tickets generated.
     *
     * @return Ticket count
     */
    public int getTicketCount() {
        return tickets != null ? tickets.size() : 0;
    }

    /**
     * Checks if the generation was successful (completed with tickets).
     *
     * @return true if tickets were generated successfully
     */
    public boolean isSuccessful() {
        return finalStatus == GenerationStatus.COMPLETED && getTicketCount() > 0;
    }

    /**
     * Checks if the generation met quality criteria.
     *
     * @return true if quality metrics indicate success
     */
    public boolean meetsQualityCriteria() {
        return qualityMetrics != null && qualityMetrics.isHighQuality();
    }
    
    /**
     * Checks if delta analysis results are available.
     *
     * @return true if delta strategy was used and analysis is available
     */
    public boolean hasDeltaAnalysis() {
        return deltaAnalysis != null;
    }
    
    /**
     * Checks if strategic delta intelligence was applied.
     *
     * @return true if strategic intelligence (drought/tier optimization) was used
     */
    public boolean hasStrategicDeltaIntelligence() {
        return deltaAnalysis != null && deltaAnalysis.isStrategicIntelligenceApplied();
    }

    /**
     * Gets a formatted summary for display purposes.
     *
     * @return Human-readable summary string
     */
    public String getDisplaySummary() {
        return String.format("Generated %d tickets in %d attempts (%.1fs) - Quality: %s (%.1f)",
                getTicketCount(),
                generationSummary != null ? generationSummary.getTotalAttempts() : 0,
                generationSummary != null ? generationSummary.getElapsedTimeSeconds() : 0.0,
                qualityMetrics != null ? qualityMetrics.getQualityGrade() : "Unknown",
                qualityMetrics != null ? qualityMetrics.getOptimizationScore() : 0.0);
    }

    /**
     * Creates a builder for GeneratedTicketSet.
     *
     * @return A new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder class for GeneratedTicketSet.
     */
    public static class Builder {
        private String sessionId;
        private Integer ticketSetId;
        private List<int[]> tickets;
        private QualityMetrics qualityMetrics;
        private GenerationSummary generationSummary;
        private String lotteryConfigId;
        private LocalDateTime generatedAt = LocalDateTime.now();
        private GenerationStatus finalStatus = GenerationStatus.COMPLETED;
        private HistoricalPerformanceAnalysis historicalPerformance;
        private DroughtInformationService.DroughtInformation droughtInformation;
        private TemplateMatrixAnalysisResult templateMatrixAnalysis;
        private List<TemplateCorrelatedTicket> templateCorrelatedTickets;
        private DeltaAnalysisResult deltaAnalysis;

        public Builder sessionId(String sessionId) {
            this.sessionId = sessionId;
            return this;
        }

        public Builder ticketSetId(Integer ticketSetId) {
            this.ticketSetId = ticketSetId;
            return this;
        }

        public Builder tickets(List<int[]> tickets) {
            this.tickets = tickets;
            return this;
        }

        public Builder qualityMetrics(QualityMetrics qualityMetrics) {
            this.qualityMetrics = qualityMetrics;
            return this;
        }

        public Builder generationSummary(GenerationSummary generationSummary) {
            this.generationSummary = generationSummary;
            return this;
        }

        public Builder lotteryConfigId(String lotteryConfigId) {
            this.lotteryConfigId = lotteryConfigId;
            return this;
        }

        public Builder generatedAt(LocalDateTime generatedAt) {
            this.generatedAt = generatedAt;
            return this;
        }

        public Builder finalStatus(GenerationStatus finalStatus) {
            this.finalStatus = finalStatus;
            return this;
        }

        public Builder historicalPerformance(HistoricalPerformanceAnalysis historicalPerformance) {
            this.historicalPerformance = historicalPerformance;
            return this;
        }

        public Builder droughtInformation(DroughtInformationService.DroughtInformation droughtInformation) {
            this.droughtInformation = droughtInformation;
            return this;
        }

        public Builder templateMatrixAnalysis(TemplateMatrixAnalysisResult templateMatrixAnalysis) {
            this.templateMatrixAnalysis = templateMatrixAnalysis;
            return this;
        }

        public Builder templateCorrelatedTickets(List<TemplateCorrelatedTicket> templateCorrelatedTickets) {
            this.templateCorrelatedTickets = templateCorrelatedTickets;
            return this;
        }

        public Builder deltaAnalysis(DeltaAnalysisResult deltaAnalysis) {
            this.deltaAnalysis = deltaAnalysis;
            return this;
        }

        public GeneratedTicketSet build() {
            if (sessionId == null || lotteryConfigId == null) {
                throw new IllegalStateException("sessionId and lotteryConfigId are required");
            }
            
            if (deltaAnalysis != null) {
                return new GeneratedTicketSet(sessionId, ticketSetId, tickets, qualityMetrics, generationSummary,
                                            lotteryConfigId, generatedAt, finalStatus, 
                                            historicalPerformance, droughtInformation, templateMatrixAnalysis,
                                            templateCorrelatedTickets, deltaAnalysis);
            } else if (templateCorrelatedTickets != null) {
                return new GeneratedTicketSet(sessionId, ticketSetId, tickets, qualityMetrics, generationSummary,
                                            lotteryConfigId, generatedAt, finalStatus, 
                                            historicalPerformance, droughtInformation, templateMatrixAnalysis,
                                            templateCorrelatedTickets);
            } else if (templateMatrixAnalysis != null) {
                return new GeneratedTicketSet(sessionId, ticketSetId, tickets, qualityMetrics, generationSummary,
                                            lotteryConfigId, generatedAt, finalStatus, 
                                            historicalPerformance, droughtInformation, templateMatrixAnalysis);
            } else if (droughtInformation != null) {
                return new GeneratedTicketSet(sessionId, ticketSetId, tickets, qualityMetrics, generationSummary,
                                            lotteryConfigId, generatedAt, finalStatus, 
                                            historicalPerformance, droughtInformation);
            } else {
                return new GeneratedTicketSet(sessionId, ticketSetId, tickets, qualityMetrics, generationSummary,
                                            lotteryConfigId, generatedAt, finalStatus, historicalPerformance);
            }
        }
    }

    @Override
    public String toString() {
        return String.format("GeneratedTicketSet{sessionId='%s', tickets=%d, status=%s, quality=%s}",
                sessionId, getTicketCount(), finalStatus, 
                qualityMetrics != null ? qualityMetrics.getQualityGrade() : "N/A");
    }
}