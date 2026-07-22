package pe.taskflow.board.arena;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/** Nombres graciosos de temática de programación para los bots del arena. */
public final class BotNames {

    private static final List<String> NAMES = List.of(
            "NullPointer", "SyntaxError", "StackOverflow", "CtrlAltDel", "InfiniteLoop",
            "MergeConflict", "DivByZero", "SegFault", "RaceCondition", "DeadlockDan",
            "ByteMe", "HexHunter", "RegexRicky", "CacheMiss", "GitBlame",
            "ForceQuit", "TabsNotSpaces", "SudoMaster", "Error404", "PingTimeout",
            "BitFlipper", "KernelPanic", "ZombieProcess", "HeapOverflow", "BrokenPromise",
            "AsyncAwait", "CallbackHell", "TypoKing", "VarNombre", "FueraDeRango",
            "CafeConBugs", "CommitMessage", "LazyLoader", "NaNSquad", "FalsePositive",
            "GhostPointer", "RootAccess", "BoolMaster", "QuantumBug", "LagMachine",
            "PixelPirata", "CodigoEspagueti", "BinaryBandit", "DebugDiva", "CompilerSays",
            "ForkBomb", "EchoChamber", "TryCatchMe", "WhileTrue", "VoidWalker",
            "HotFixHero", "LintLord", "BranchBoss", "DataRace", "ZeroDayZoe"
    );

    private BotNames() {
    }

    public static String random() {
        return NAMES.get(ThreadLocalRandom.current().nextInt(NAMES.size()));
    }
}
