export async function queryMySQL(connection: any, query: string, values: any): Promise<any> {
    try {
        const [rows] = await connection.execute(query, values);
        return rows;
    } catch (error) {
        throw error;
    }
}
