package pe.taskflow.board.arena;

/** Un jugador o un bot dentro del arena: un círculo que se mueve y crece. */
public class Blob {

    private final String id;
    private final boolean bot;
    private String name;
    private String color;
    private double x;
    private double y;
    private double radius;
    private double targetX;
    private double targetY;

    public Blob(String id, boolean bot, String name, String color, double x, double y, double radius) {
        this.id = id;
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
