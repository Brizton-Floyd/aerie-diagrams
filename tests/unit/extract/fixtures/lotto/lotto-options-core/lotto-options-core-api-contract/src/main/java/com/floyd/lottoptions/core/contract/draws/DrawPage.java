package com.floyd.lottoptions.core.contract.draws;

import com.floyd.lottoptions.core.contract.game.GameRules;

import java.util.List;

/**
 * Response body of {@code GET /api/v1/analysis/{state}/{game}/draws}: one page of the game's
 * draw history, each draw with the games out after it, and the game's rules. Indexes count the
 * draws oldest first, from {@code 0}.
 *
 * @param rules      the game's rules
 * @param totalDraws the draws in the whole history
 * @param startIndex the index of the page's oldest draw
 * @param endIndex   the index just past the page's latest draw
 * @param draws      the page's draws, oldest draw first
 */
public record DrawPage(GameRules rules, int totalDraws, int startIndex, int endIndex, List<DrawRow> draws) {}
