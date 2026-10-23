package com.floyd.lottoptions.core.domain.range;

import java.util.ArrayList;
import java.util.List;

/**
 * The deltas of a draw's numbers: the first number itself, then the distance from each number
 * to the one before it. {@code [1, 15, 18, 22, 35]} has the deltas {@code [1, 14, 3, 4, 13]}.
 */
public final class Deltas {

    private Deltas() {
    }

    /**
     * @param numbers the numbers, in the order the draw lists them
     * @return the deltas, one per number; none for no numbers
     */
    public static List<Integer> of(List<Integer> numbers) {
        List<Integer> deltas = new ArrayList<>(numbers.size());
        for (int i = 0; i < numbers.size(); i++) {
            deltas.add(i == 0 ? numbers.get(0) : Math.abs(numbers.get(i) - numbers.get(i - 1)));
        }
        return deltas;
    }
}
