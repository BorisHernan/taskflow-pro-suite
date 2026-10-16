package pe.taskflow.board.arena;

/**
 * Una célula del arena. Un jugador puede tener varias (al dividirse): todas
 * comparten ownerId. Los efectos y el tiempo para volver a fusionarse se
 * cuentan en ticks, así el motor es determinista y fácil de testear.
 */
public class Blob {

    private final String id;
    private String ownerId;
    private final boolean bot;
    private String skin = "clasico";
    // Impulso al dividirse: se suma al movimiento normal y se frena cada tick.
    private double vx;
    private double vy;
    private int fusionTicks;
    private int velocidadTicks;
    private int escudoTicks;
    private int imanTicks;
    private String name;
    private String color;
    private double x;
    private double y;
    private double radius;
    private double targetX;
    private double targetY;

    public Blob(String id, boolean bot, String name, String color, double x, double y, double radius) {
        this.id = id;
        this.ownerId = id;
        this.bot = bot;
        this.name = name;
        this.color = color;
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.targetX = x;
        this.targetY = y;
    }

    public String getId() {
        return id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public String getSkin() {
        return skin;
    }

    public void setSkin(String skin) {
        this.skin = skin;
    }

    public double getVx() {
        return vx;
    }

    public void setVx(double vx) {
        this.vx = vx;
    }

    public double getVy() {
        return vy;
    }

    public void setVy(double vy) {
        this.vy = vy;
    }

    public int getFusionTicks() {
        return fusionTicks;
    }

    public void setFusionTicks(int fusionTicks) {
        this.fusionTicks = fusionTicks;
    }

    public int getVelocidadTicks() {
        return velocidadTicks;
    }

    public void setVelocidadTicks(int velocidadTicks) {
        this.velocidadTicks = velocidadTicks;
    }

    public int getEscudoTicks() {
        return escudoTicks;
    }

    public void setEscudoTicks(int escudoTicks) {
        this.escudoTicks = escudoTicks;
    }

    public int getImanTicks() {
        return imanTicks;
    }

    public void setImanTicks(int imanTicks) {
        this.imanTicks = imanTicks;
    }

    /** Baja en uno todos los contadores (efectos y fusión). */
    public void avanzarTick() {
        fusionTicks = Math.max(0, fusionTicks - 1);
        velocidadTicks = Math.max(0, velocidadTicks - 1);
        escudoTicks = Math.max(0, escudoTicks - 1);
        imanTicks = Math.max(0, imanTicks - 1);
    }

    public boolean isBot() {
        return bot;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public double getRadius() {
        return radius;
    }

    public void setRadius(double radius) {
        this.radius = radius;
    }

    public double getTargetX() {
        return targetX;
    }

    public void setTargetX(double targetX) {
        this.targetX = targetX;
    }

    public double getTargetY() {
        return targetY;
    }

    public void setTargetY(double targetY) {
        this.targetY = targetY;
    }
}
